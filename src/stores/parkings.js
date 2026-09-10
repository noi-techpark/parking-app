// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  fetchStationMetadata,
  fetchStationValues,
  fetchSensors,
  fetchForecasts,
  fetchForecastBand,
} from '../api/mobility.js'
import { fetchParkingPois } from '../api/tourism.js'
import {
  buildStationIndex,
  applyStationValues,
  normalizeSensors,
  normalizePois,
  normalizeForecast,
  normalizeForecasts,
} from '../lib/normalize.js'
import { CATEGORY, classify, compareParkings } from '../lib/availability.js'
import {
  loadMunicipalities,
  createMunicipalityResolver,
  municipalityDisplayName,
} from '../lib/geo/municipalities.js'
import { parseDuration } from '../lib/duration.js'
import { DEFAULT_LOCALE, toIso1 } from '../lib/locale.js'

export const DEFAULTS = {
  /** How recent a reading has to be to count as real time. */
  liveMaxAge: '30m',
  /** Past this, a reading is not shown at all. */
  staleMaxAge: '6mo',
  /** Poll interval for the (small) readings request. */
  refreshInterval: '60s',
  /** Station metadata is static; refetch occasionally to pick up new stations. */
  metadataInterval: '30m',
}

export const useParkingStore = defineStore('parkings', () => {
  const config = ref({
    liveMaxAge: parseDuration(DEFAULTS.liveMaxAge),
    staleMaxAge: parseDuration(DEFAULTS.staleMaxAge),
    refreshInterval: parseDuration(DEFAULTS.refreshInterval),
    metadataInterval: parseDuration(DEFAULTS.metadataInterval),
    locale: DEFAULT_LOCALE,
    showStatic: true,
    originFilter: [],
  })

  // Large, replaced wholesale — no need for deep reactivity.
  const parkings = shallowRef([])
  const municipalities = shallowRef([])

  /**
   * The decoded boundary dataset, as a ref rather than a getter.
   *
   * It has to be reactive: a computed that reads a plain getter first and
   * short-circuits on null never registers its other dependencies, so it caches
   * an empty result forever and silently stops updating.
   */
  const geoDataset = shallowRef(null)

  const status = ref('idle') // idle | loading | ready | error
  const error = ref(null)
  const lastRefresh = ref(null)
  const boundariesReady = ref(false)

  const selectedMunicipalityIds = ref([])
  /**
   * Hand-picked parkings. Non-empty means "show me only these" — the custom
   * dashboard case. Deliberately separate from `focusedParkingId`: opening a
   * parking's detail must not silently narrow the whole view to it.
   */
  const selectedParkingIds = ref([])
  /** The one parking whose detail panel is open, if any. */
  const focusedParkingId = ref(null)
  const selectedOrigins = ref([])
  /**
   * Freshness buckets to keep. Lives here rather than in the view because the
   * map draws `visibleParkings`: a filter the list applied on its own narrowed
   * the cards while leaving the markers — and the cluster counts — untouched.
   */
  const selectedStatuses = ref([])
  /**
   * Parkings the visitor never wants to see.
   *
   * Always wins over every other filter, including an explicit parking
   * selection — hiding something has to mean hiding it, or the control is not
   * trustworthy.
   */
  const excludedParkingIds = ref([])
  const searchTerm = ref('')

  // Kept out of reactive state: fetched once, mutated in place.
  let stationIndex = new Map()
  // Kept so a language change can rename everything without another round-trip.
  let metadataRows = null
  let poiItems = null
  let geo = null
  let resolveMunicipality = null
  let metadataFetchedAt = 0
  /*
   * Forecast series by station code.
   *
   * Every station's headline forecast arrives in one ~100 kB request, so each
   * list card can draw a sparkline without a per-station fetch. Held outside
   * the parking list because refresh() replaces that wholesale, which would
   * otherwise drop the series on every poll.
   */
  let forecastSeries = new Map()
  // Low/high bands, fetched per station only when a detail view opens.
  const forecastBands = new Map()
  let lastValueRows = null
  let lastSensorRows = null
  let timer = null
  let controller = null

  function configure(patch = {}) {
    const previousLocale = config.value.locale
    config.value = { ...config.value, ...patch }

    // Station and POI names are language-dependent, so a locale change has to
    // rebuild them — from the metadata already in hand, not a new request.
    if (patch.locale && patch.locale !== previousLocale) relabel()
  }

  function relabel() {
    if (!metadataRows) return
    stationIndex = buildStationIndex(metadataRows, toIso1(config.value.locale))
    if (lastValueRows) {
      parkings.value = decorate(combineSources(lastValueRows, lastSensorRows), Date.now())
      municipalities.value = collectMunicipalities(parkings.value)
    }
  }

  /**
   * Boundaries arrive after first paint, so parkings are usable immediately and
   * gain their municipality a beat later.
   */
  async function ensureBoundaries() {
    if (geo) return geo
    geo = await loadMunicipalities()
    resolveMunicipality = createMunicipalityResolver(geo)
    geoDataset.value = geo
    boundariesReady.value = true
    return geo
  }

  function decorate(list, now) {
    const { liveMaxAge, staleMaxAge } = config.value

    const decorated = []
    for (const parking of list) {
      const category = classify(parking, { now, liveMaxAge, staleMaxAge })
      // Requirement 6: anything past the retention window is dropped outright.
      if (category === CATEGORY.DROPPED) continue

      let municipalityId = null
      let municipalityName = parking.municipalityHint
      let municipalityApprox = false

      if (resolveMunicipality && parking.coord?.lon != null) {
        const hit = resolveMunicipality(
          parking.id,
          parking.coord.lon,
          parking.coord.lat
        )
        if (hit) {
          municipalityId = hit.id
          municipalityApprox = hit.approx
          municipalityName = localisedMunicipalityName(hit.id) ?? hit.name
        }
      }

      decorated.push({
        ...parking,
        category,
        municipalityId,
        municipalityName,
        municipalityApprox,
        forecast: forecastBands.get(parking.scode) ?? forecastSeries.get(parking.scode) ?? null,
      })
    }

    decorated.sort(compareParkings)
    return decorated
  }

  function localisedMunicipalityName(id) {
    return municipalityDisplayName(geo?.byId.get(id), toIso1(config.value.locale))
  }

  /** Municipalities that actually contain a visible parking. */
  function collectMunicipalities(list) {
    const counts = new Map()
    for (const parking of list) {
      if (!parking.municipalityId) continue
      const existing = counts.get(parking.municipalityId)
      if (existing) {
        existing.count++
        continue
      }
      counts.set(parking.municipalityId, {
        id: parking.municipalityId,
        name: parking.municipalityName,
        country: geo?.byId.get(parking.municipalityId)?.c ?? null,
        count: 1,
      })
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  /** The three feeds, normalised and merged into one list. */
  function combineSources(valueRows, sensorRows) {
    return [
      ...applyStationValues(stationIndex, valueRows ?? []),
      ...normalizeSensors(sensorRows ?? []),
      ...(config.value.showStatic
        ? normalizePois(poiItems ?? [], toIso1(config.value.locale))
        : []),
    ]
  }

  async function refresh({ force = false } = {}) {
    controller?.abort()
    controller = new AbortController()
    const { signal } = controller
    const now = Date.now()
    const { staleMaxAge } = config.value

    if (status.value === 'idle') status.value = 'loading'

    try {
      const needsMetadata =
        force || !stationIndex.size || now - metadataFetchedAt > config.value.metadataInterval

      const [freshMetadata, valueRows, sensorRows, forecastRows] = await Promise.all([
        needsMetadata
          ? fetchStationMetadata({ staleMaxAge, now, signal })
          : Promise.resolve(null),
        fetchStationValues({ staleMaxAge, now, signal }),
        fetchSensors({ staleMaxAge, now, signal }),
        // Predictions move hourly; no reason to refetch them every minute.
        needsMetadata
          ? fetchForecasts({ signal }).catch(() => null)
          : Promise.resolve(null),
      ])

      if (freshMetadata) {
        metadataRows = freshMetadata
        stationIndex = buildStationIndex(metadataRows, toIso1(config.value.locale))
        metadataFetchedAt = now
      }
      if (forecastRows) {
        forecastSeries = normalizeForecasts(forecastRows, stationIndex)
      }

      // Editorial content, not a live feed: fetch once. The endpoint also
      // rate-limits anonymous callers, which the old 60s loop kept tripping.
      if (poiItems === null) {
        poiItems = await fetchParkingPois({ signal }).catch(() => [])
      }

      await ensureBoundaries().catch(() => {
        // Grouping is a progressive enhancement; parkings still render.
      })

      lastValueRows = valueRows
      lastSensorRows = sensorRows
      parkings.value = decorate(combineSources(valueRows, sensorRows), now)
      municipalities.value = collectMunicipalities(parkings.value)
      lastRefresh.value = now
      status.value = 'ready'
      error.value = null
    } catch (err) {
      if (err?.name === 'AbortError') return
      error.value = err
      if (status.value !== 'ready') status.value = 'error'
    }
  }

  /**
   * Polling that stops when the tab is hidden and when the element goes away.
   * The original recursed through setTimeout with no handle, so a removed
   * webcomponent kept polling the API forever.
   */
  function startPolling() {
    stopPolling()
    const tick = () => {
      if (document.visibilityState === 'visible') refresh()
      timer = setTimeout(tick, config.value.refreshInterval)
    }
    timer = setTimeout(tick, config.value.refreshInterval)
    document.addEventListener('visibilitychange', onVisibility)
  }

  function onVisibility() {
    if (document.visibilityState === 'visible') refresh()
  }

  function stopPolling() {
    if (timer) clearTimeout(timer)
    timer = null
    document.removeEventListener('visibilitychange', onVisibility)
    controller?.abort()
    controller = null
  }

  /**
   * The URL and the `parkings` attribute both carry station codes, because that
   * is what the API and the operators use. Internally a parking is keyed by a
   * source-prefixed id, so any code sitting in a selection has to be translated.
   *
   * Watched rather than called after each fetch: attributes are applied once the
   * first fetch has already finished, so a code-based selection would otherwise
   * match nothing until the next poll — an empty list for a whole minute.
   */
  function reconcileSelectedParkings() {
    if (!parkings.value.length) return

    const ids = new Set(parkings.value.map((p) => p.id))
    const byScode = new Map(parkings.value.map((p) => [p.scode, p.id]))

    for (const selection of [selectedParkingIds, excludedParkingIds]) {
      if (!selection.value.length) continue
      const mapped = selection.value.map((value) =>
        ids.has(value) ? value : (byScode.get(value) ?? value)
      )
      if (mapped.some((value, i) => value !== selection.value[i])) selection.value = mapped
    }
  }

  /**
   * Resolves whatever an integrator wrote into municipality ids.
   *
   * Accepts the id itself, the official OSM name, any of its language variants
   * and the current display name, all case-insensitively — matching only the
   * localised display name meant `municipalities="Bolzano - Bozen"` silently
   * matched nothing as soon as `language="it"` renamed it to "Bolzano".
   */
  watch([parkings, selectedParkingIds, excludedParkingIds], reconcileSelectedParkings)

  function municipalityIdsFor(entries) {
    if (!geo) return []

    const lookup = new Map()
    const add = (key, id) => {
      if (key) lookup.set(String(key).trim().toLowerCase(), id)
    }
    for (const entry of geo.index) {
      add(entry.id, entry.id)
      add(entry.n, entry.id)
      for (const variant of Object.values(entry.nm ?? {})) add(variant, entry.id)
      add(municipalityDisplayName(entry, toIso1(config.value.locale)), entry.id)
    }

    return entries.map((entry) => lookup.get(String(entry).trim().toLowerCase())).filter(Boolean)
  }

  /** Internal ids -> station codes, for anything user-facing like a URL. */
  function scodesFor(ids) {
    const byId = new Map(parkings.value.map((p) => [p.id, p.scode]))
    return ids.map((id) => byId.get(id) ?? id)
  }

  /**
   * Upgrades an opened parking's series with its low/high confidence band.
   * The headline series is already present from the bulk fetch, so the chart
   * draws immediately and merely gains its uncertainty band a moment later.
   */
  async function loadForecast(parkingId) {
    const parking = parkings.value.find((p) => p.id === parkingId)
    if (!parking || parking.source !== 'station') return
    if (forecastBands.has(parking.scode)) return
    if (!Number.isFinite(parking.capacity)) return

    try {
      const rows = await fetchForecastBand(parking.scode)
      const series = normalizeForecast(rows, {
        capacity: parking.capacity,
        freeNow: parking.free,
      })
      if (!series.length) return

      forecastBands.set(parking.scode, series)
      // shallowRef: replace the entry so consumers re-render.
      parkings.value = parkings.value.map((p) =>
        p.id === parkingId ? { ...p, forecast: series } : p
      )
    } catch {
      // The headline series is already on screen; a missing band is not fatal.
    }
  }

  const availableOrigins = computed(() => {
    const counts = new Map()
    for (const parking of parkings.value) {
      const origin = parking.origin ?? 'unknown'
      counts.set(origin, (counts.get(origin) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
  })

  /** Everything the filters keep, before the status facet narrows it. */
  const filteredParkings = computed(() => {
    const hidden = new Set(excludedParkingIds.value)

    // An explicit parking selection overrides every other filter: the user has
    // named exactly what they want on their dashboard. Exclusions still apply.
    const pinned = new Set(selectedParkingIds.value)
    if (pinned.size) {
      return parkings.value.filter(
        (parking) => pinned.has(parking.id) && !hidden.has(parking.id)
      )
    }

    const municipalityIds = new Set(selectedMunicipalityIds.value)
    const origins = new Set(
      selectedOrigins.value.length ? selectedOrigins.value : config.value.originFilter
    )
    const term = searchTerm.value.trim().toLowerCase()

    return parkings.value.filter((parking) => {
      if (hidden.has(parking.id)) return false
      if (!config.value.showStatic && parking.category === CATEGORY.STATIC) {
        return false
      }
      if (municipalityIds.size && !municipalityIds.has(parking.municipalityId)) {
        return false
      }
      if (origins.size && !origins.has(parking.origin)) return false
      if (term) {
        const haystack = `${parking.name ?? ''} ${parking.municipalityName ?? ''}`
        if (!haystack.toLowerCase().includes(term)) return false
      }
      return true
    })
  })

  const visibleParkings = computed(() => {
    const statuses = new Set(selectedStatuses.value)
    if (!statuses.size) return filteredParkings.value
    return filteredParkings.value.filter((parking) => statuses.has(parking.category))
  })

  /** Resolved excluded parkings, so the filter can list them by name. */
  const excludedParkings = computed(() => {
    const ids = new Set(excludedParkingIds.value)
    return parkings.value.filter((parking) => ids.has(parking.id))
  })

  const selectedParkings = computed(() => {
    const ids = new Set(selectedParkingIds.value)
    return parkings.value.filter((parking) => ids.has(parking.id))
  })

  /**
   * Every parking as a pickable option, for the "specific parkings" filter.
   * The municipality is folded into the label because names repeat across
   * towns — several "Parcheggio Stazione" exist.
   */
  const parkingOptions = computed(() =>
    parkings.value
      .map((parking) => ({
        id: parking.id,
        name: parking.municipalityName
          ? `${parking.name ?? parking.scode} · ${parking.municipalityName}`
          : (parking.name ?? parking.scode),
        count: parking.free ?? undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  )

  /** Counted before the status facet, so its own options keep their totals. */
  const counts = computed(() => {
    const result = { live: 0, delayed: 0, static: 0, total: 0 }
    for (const parking of filteredParkings.value) {
      result[parking.category] = (result[parking.category] ?? 0) + 1
      result.total++
    }
    return result
  })

  function toggle(listRef, id, multi = true) {
    const current = listRef.value
    if (current.includes(id)) {
      listRef.value = current.filter((item) => item !== id)
      return
    }
    listRef.value = multi ? [...current, id] : [id]
  }

  return {
    config,
    configure,
    parkings,
    municipalities,
    availableOrigins,
    visibleParkings,
    selectedParkings,
    counts,
    status,
    error,
    lastRefresh,
    boundariesReady,
    selectedMunicipalityIds,
    selectedParkingIds,
    focusedParkingId,
    selectedOrigins,
    selectedStatuses,
    excludedParkings,
    excludedParkingIds,
    searchTerm,
    parkingOptions,
    refresh,
    startPolling,
    stopPolling,
    loadForecast,
    scodesFor,
    municipalityIdsFor,
    ensureBoundaries,
    geoDataset,
    toggleMunicipality: (id, multi) => toggle(selectedMunicipalityIds, id, multi),
    toggleParking: (id, multi) => toggle(selectedParkingIds, id, multi),
    toggleOrigin: (id, multi) => toggle(selectedOrigins, id, multi),
    toggleStatus: (id, multi) => toggle(selectedStatuses, id, multi),
    toggleExcluded: (id, multi) => toggle(excludedParkingIds, id, multi),
  }
})
