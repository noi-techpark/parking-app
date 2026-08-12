<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div ref="root" class="app" :class="`app--${layout}`">
    <!-- Results. A column when there is room, the bottom sheet otherwise. -->
    <section v-if="layout !== 'narrow'" class="panel">
      <header class="panel-head">
        <AppBrand />
        <input
          v-model="store.searchTerm"
          type="search"
          class="parking-search"
          :placeholder="t('common.search')"
          :aria-label="t('common.search')"
        />
        <ActiveFilters
          :chips="chips"
          :count="listed.length"
          @remove="removeChip"
          @clear="clearAllFilters"
        />
      </header>
      <div class="panel-body">
        <component :is="panelInner" />
      </div>
      <footer class="panel-foot">
        <a href="https://opendatahub.com" target="_blank" rel="noopener">
          {{ t('common.poweredBy') }} Open Data Hub
        </a>
      </footer>
    </section>

    <div class="map">
      <MapCanvas
        ref="mapRef"
        :parkings="store.visibleParkings"
        :selected-ids="highlightedIds"
        :boundaries="selectedBoundaries"
        :aria-label="t('map.label')"
        @select="onSelectParking"
      />

      <!-- Filters live over the map so they cost no layout space. -->
      <div class="filter-bar">
        <div v-for="facet in facets" :key="facet.key" class="filter-slot">
          <FilterPill
            :title="facet.title"
            :value="facet.value"
            :active="facet.selected.length > 0"
            :open="openFacet === facet.key"
            :disabled="!facet.options.length"
            @toggle="openFacet = openFacet === facet.key ? null : facet.key"
          />
          <FilterPanel
            v-if="openFacet === facet.key"
            class="filter-pop"
            :title="facet.title"
            @close="openFacet = null"
            @clear="facet.clear()"
          >
            <FacetList
              :title="facet.title"
              :options="facet.options"
              :selected="facet.selected"
              :multi="facet.multi"
              :searchable="facet.searchable"
              :search-placeholder="facet.searchPlaceholder ?? t('filters.searchMunicipality')"
              :limit="facet.searchable ? 40 : 12"
              hide-header
              @toggle="facet.toggle"
              @clear="facet.clear()"
            />
          </FilterPanel>
        </div>
      </div>
    </div>

    <BottomSheet v-if="layout === 'narrow'" ref="sheetRef" :label="t('filters.title')">
      <header class="sheet-head">
        <input
          v-model="store.searchTerm"
          type="search"
          class="parking-search"
          :placeholder="t('common.search')"
          :aria-label="t('common.search')"
        />
        <ActiveFilters
          :chips="chips"
          :count="listed.length"
          @remove="removeChip"
          @clear="clearAllFilters"
        />
      </header>
      <component :is="panelInner" />
    </BottomSheet>
  </div>
</template>

<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AppBrand from '@/components/chrome/AppBrand.vue'
import FacetList from '@/components/filters/FacetList.vue'
import FilterPill from '@/components/filters/FilterPill.vue'
import FilterPanel from '@/components/filters/FilterPanel.vue'
import ActiveFilters from '@/components/filters/ActiveFilters.vue'
import MapCanvas from '@/components/map/MapCanvas.vue'
import BottomSheet from '@/components/layout/BottomSheet.vue'
import ParkingCard from '@/components/parking/ParkingCard.vue'
import ParkingDetail from '@/components/parking/ParkingDetail.vue'

import { useParkingStore, DEFAULTS } from '@/stores/parkings.js'
import { CATEGORY } from '@/lib/availability.js'
import { boundsOf, compositeCentroidOf } from '@/lib/geo/municipalities.js'
import { parseDuration } from '@/lib/duration.js'
import { parseBool, parseList, parseLonLat, parseNumber } from '@/lib/attributes.js'
import { IS_STANDALONE } from '@/lib/config.js'
import { useUrlState } from '@/composables/useUrlState.js'

/**
 * Root of the `bolzano-parking-app` custom element.
 *
 * Every option is declared as a String because custom-element attributes are
 * strings; see lib/attributes.js for why typing them as Boolean is a trap.
 */
const props = defineProps({
  municipalities: { type: String, default: '' },
  multiMunicipality: { type: String, default: 'true' },
  parkings: { type: String, default: '' },
  multiParking: { type: String, default: 'true' },
  origins: { type: String, default: '' },
  multiOrigin: { type: String, default: 'true' },
  /** Comma-separated `live`, `delayed`, `static`. Empty means no restriction. */
  status: { type: String, default: '' },
  /** Seeds the free-text search box. */
  search: { type: String, default: '' },
  staleMaxAge: { type: String, default: DEFAULTS.staleMaxAge },
  liveMaxAge: { type: String, default: DEFAULTS.liveMaxAge },
  refreshInterval: { type: String, default: DEFAULTS.refreshInterval },
  showStatic: { type: String, default: 'true' },
  language: { type: String, default: 'en' },
  center: { type: String, default: '' },
  zoom: { type: String, default: '' },
})

const { t, locale } = useI18n()
const store = useParkingStore()

const root = ref(null)
const mapRef = ref(null)
const sheetRef = ref(null)
const openFacet = ref(null)
const selectedStatuses = ref([])
const width = ref(1200)

const multiMunicipalityEnabled = computed(() => parseBool(props.multiMunicipality, true))
const multiParkingEnabled = computed(() => parseBool(props.multiParking, true))
const multiOriginEnabled = computed(() => parseBool(props.multiOrigin, true))
const showStaticEnabled = computed(() => parseBool(props.showStatic, true))

/**
 * Breakpoints are measured on the element, not the viewport: a webcomponent can
 * be dropped into a 400px column on a desktop page and must lay out for the box
 * it actually occupies.
 */
const layout = computed(() => {
  if (width.value < 760) return 'narrow'
  if (width.value < 1080) return 'medium'
  return 'wide'
})

const now = ref(Date.now())
let clock = null
let observer = null

const selected = computed(() =>
  store.parkings.find((p) => p.id === store.focusedParkingId)
)

const statusOptions = computed(() => [
  { id: CATEGORY.LIVE, name: t('status.live'), count: store.counts.live ?? 0 },
  { id: CATEGORY.DELAYED, name: t('status.delayed'), count: store.counts.delayed ?? 0 },
  { id: CATEGORY.STATIC, name: t('status.static'), count: store.counts.static ?? 0 },
])

/** One descriptor per pill, so the bar and the chips stay in step. */
const facets = computed(() => [
  {
    key: 'municipality',
    title: t('filters.municipalities'),
    options: store.municipalities,
    selected: store.selectedMunicipalityIds,
    multi: multiMunicipalityEnabled.value,
    searchable: true,
    value: summarise(store.selectedMunicipalityIds, store.municipalities),
    toggle: (id) => store.toggleMunicipality(id, multiMunicipalityEnabled.value),
    clear: () => {
      store.selectedMunicipalityIds = []
    },
  },
  {
    key: 'origin',
    title: t('filters.origins'),
    options: store.availableOrigins.map((o) => ({ ...o, name: o.id })),
    selected: store.selectedOrigins,
    multi: multiOriginEnabled.value,
    searchable: false,
    value: summarise(store.selectedOrigins, store.availableOrigins),
    toggle: (id) => store.toggleOrigin(id, multiOriginEnabled.value),
    clear: () => {
      store.selectedOrigins = []
    },
  },
  {
    key: 'parking',
    title: t('filters.parkings'),
    options: store.parkingOptions,
    selected: store.selectedParkingIds,
    multi: multiParkingEnabled.value,
    searchable: true,
    searchPlaceholder: t('filters.searchParking'),
    value: summarise(store.selectedParkingIds, store.parkingOptions),
    toggle: (id) => store.toggleParking(id, multiParkingEnabled.value),
    clear: () => {
      store.selectedParkingIds = []
    },
  },
  {
    key: 'status',
    title: t('filters.status'),
    options: statusOptions.value,
    selected: selectedStatuses.value,
    multi: true,
    searchable: false,
    value: summarise(selectedStatuses.value, statusOptions.value),
    toggle: toggleStatus,
    clear: () => {
      selectedStatuses.value = []
    },
  },
])

/** A pill always states its selection: a name, a count, or "all". */
function summarise(selectedIds, options) {
  if (!selectedIds.length) return t('filters.all')
  if (selectedIds.length === 1) {
    const match = options.find((o) => o.id === selectedIds[0])
    return match?.name ?? match?.id ?? '1'
  }
  return String(selectedIds.length)
}

const chips = computed(() =>
  facets.value.flatMap((facet) =>
    facet.selected.map((id) => ({
      facet: facet.key,
      id,
      label: facet.options.find((o) => o.id === id)?.name ?? id,
    }))
  )
)

function removeChip(chip) {
  facets.value.find((f) => f.key === chip.facet)?.toggle(chip.id)
}

function clearAllFilters() {
  for (const facet of facets.value) facet.clear()
  store.searchTerm = ''
}

const listed = computed(() => {
  let result = store.visibleParkings
  if (selectedStatuses.value.length) {
    const wanted = new Set(selectedStatuses.value)
    result = result.filter((p) => wanted.has(p.category))
  }

  // Whatever is selected stays at the top, so picking a marker on the map never
  // means hunting for its card in a list of hundreds.
  const chosen = new Set(store.selectedParkingIds)
  if (store.focusedParkingId) chosen.add(store.focusedParkingId)
  if (!chosen.size) return result
  return [
    ...result.filter((p) => chosen.has(p.id)),
    ...result.filter((p) => !chosen.has(p.id)),
  ]
})

/** The map highlights both the open detail and anything pinned. */
const highlightedIds = computed(() =>
  store.focusedParkingId
    ? [...store.selectedParkingIds, store.focusedParkingId]
    : store.selectedParkingIds
)

const selectedBoundaries = computed(() => {
  // Read both dependencies before any short-circuit, so the computed tracks the
  // selection even while the boundary dataset is still loading.
  const ids = store.selectedMunicipalityIds
  const geo = store.geoDataset
  if (!geo || !ids.length) return []
  return ids
    .map((id) => {
      const geometry = geo.geometryById.get(id)
      return geometry ? { type: 'Feature', properties: { id }, geometry } : null
    })
    .filter(Boolean)
})

function toggleStatus(id) {
  selectedStatuses.value = selectedStatuses.value.includes(id)
    ? selectedStatuses.value.filter((s) => s !== id)
    : [...selectedStatuses.value, id]
}

function onSelectParking(parking) {
  // Selecting opens the detail; it does not add to the dashboard selection,
  // which is what the "specific parkings" filter is for.
  store.focusedParkingId = store.focusedParkingId === parking.id ? null : parking.id
  if (store.focusedParkingId) {
    store.loadForecast(parking.id)
    if (layout.value === 'narrow') sheetRef.value?.expand()
  }
}

/**
 * Cards per row in the results list, per breakpoint. Tune here — the grid and
 * the width of the results column both follow from it.
 */
const LIST_COLUMNS = { wide: 2, medium: 1, narrow: 1 }

const listColumns = computed(() => LIST_COLUMNS[layout.value] ?? 1)

const PAGE = 40
const renderLimit = ref(PAGE)

/**
 * The panel shows the detail of the current selection, otherwise the list.
 * Rendered through a function so the same markup serves the desktop column and
 * the mobile sheet without duplicating it in the template.
 */
const panelInner = computed(() => () => {
  if (selected.value) {
    return h(ParkingDetail, {
      parking: selected.value,
      now: now.value,
      onClose: () => {
        store.focusedParkingId = null
      },
    })
  }

  if (store.status === 'error') {
    return h('div', { class: 'notice' }, [
      h('p', t('common.loadFailed')),
      h(
        'button',
        { type: 'button', onClick: () => store.refresh({ force: true }) },
        t('common.retry')
      ),
    ])
  }

  if (store.status === 'loading' && !store.parkings.length) {
    return h('p', { class: 'notice' }, `${t('common.loading')}…`)
  }

  if (!listed.value.length) {
    return h('p', { class: 'notice' }, t('common.noResults'))
  }

  return h(
    'div',
    { class: 'list', style: { '--list-columns': listColumns.value } },
    [
    ...listed.value.slice(0, renderLimit.value).map((parking) =>
      h(ParkingCard, {
        key: parking.id,
        parking,
        now: now.value,
        selected:
          parking.id === store.focusedParkingId ||
          store.selectedParkingIds.includes(parking.id),
        onSelect: onSelectParking,
      })
    ),
    listed.value.length > renderLimit.value
      ? h(
          'button',
          {
            type: 'button',
            class: 'load-more',
            onClick: () => {
              renderLimit.value += PAGE
            },
          },
          t('filters.showMore', { count: listed.value.length })
        )
      : null,
    ]
  )
})

// Windowed rendering: with 1,400 parkings a plain v-for costs a visible pause
// on every filter change.
watch(listed, () => {
  renderLimit.value = PAGE
})

function applyConfig() {
  locale.value = props.language || 'en'
  store.configure({
    liveMaxAge: parseDuration(props.liveMaxAge, parseDuration(DEFAULTS.liveMaxAge)),
    staleMaxAge: parseDuration(props.staleMaxAge, parseDuration(DEFAULTS.staleMaxAge)),
    refreshInterval: parseDuration(
      props.refreshInterval,
      parseDuration(DEFAULTS.refreshInterval)
    ),
    locale: props.language || 'en',
    showStatic: showStaticEnabled.value,
    originFilter: parseList(props.origins),
  })
}

/**
 * Camera: an explicit override wins, then the municipality selection, then
 * everything visible.
 *
 * For a selection the centre is the composite centroid of the chosen
 * municipalities and the zoom comes from their union extent, so the camera sits
 * where you asked while still keeping every selected area on screen.
 */
function fitCamera() {
  const map = mapRef.value
  if (!map) return

  const centre = parseLonLat(props.center)
  const zoom = parseNumber(props.zoom)
  if (centre) {
    const span = zoom ? 0.02 : 0.15
    map.fitBounds(
      [centre[0] - span, centre[1] - span, centre[0] + span, centre[1] + span],
      { maxZoom: zoom ?? 14 }
    )
    return
  }

  // A hand-picked set is the most specific thing the user asked for, so frame
  // exactly those rather than the municipalities that happen to contain them.
  if (store.selectedParkingIds.length) {
    map.fitToParkings(store.visibleParkings)
    return
  }

  const geo = store.geoDataset
  const ids = store.selectedMunicipalityIds
  if (geo && ids.length) {
    const bounds = boundsOf(geo, ids)
    const centroid = compositeCentroidOf(geo, ids)
    if (bounds) {
      map.fitBounds(bounds, { centre: centroid })
      return
    }
  }
  map.fitToParkings(store.visibleParkings)
}

const writable = (get, set) => computed({ get, set })

/*
 * URL mirroring, standalone site only.
 *
 * Guarded by the build constant rather than by a flag inside the composable, so
 * the whole thing is dead code in a webcomponent build and the bundler drops
 * it. Embedded, the URL-writing code is not merely disabled — it is not there.
 *
 * Calling a composable conditionally is safe here precisely because the
 * condition is a compile-time constant: it cannot differ between instances.
 */
const urlState = IS_STANDALONE
  ? useUrlState({
      // Municipalities go in by id — they are opaque but stable, and the map
      // between id and name lives in a lazily loaded asset anyway.
      municipality: {
        ref: writable(
          () => store.selectedMunicipalityIds,
          (v) => {
            store.selectedMunicipalityIds = v
          }
        ),
        type: 'list',
      },
      origin: {
        ref: writable(
          () => store.selectedOrigins,
          (v) => {
            store.selectedOrigins = v
          }
        ),
        type: 'list',
      },
      status: { ref: selectedStatuses, type: 'list' },
      // Parkings go in by station code rather than the internal id: it is what
      // the API, the `parkings` attribute and the operators all use. The store
      // reconciles codes back to ids once the data has loaded.
      parking: {
        ref: writable(
          () => store.selectedParkingIds,
          (v) => {
            store.selectedParkingIds = v
          }
        ),
        type: 'list',
        to: (ids) => store.scodesFor(ids),
      },
      search: {
        ref: writable(
          () => store.searchTerm,
          (v) => {
            store.searchTerm = v
          }
        ),
        type: 'string',
      },
    })
  : null

onMounted(async () => {
  applyConfig()

  observer = new ResizeObserver(([entry]) => {
    width.value = entry.contentRect.width
  })
  observer.observe(root.value)
  width.value = root.value?.clientWidth || 1200

  clock = setInterval(() => {
    now.value = Date.now()
  }, 30_000)

  await store.refresh()
  store.startPolling()

  // Attributes seed the selection; anything already in the URL wins over them.
  const wantedMunicipalities = parseList(props.municipalities)
  if (wantedMunicipalities.length && !store.selectedMunicipalityIds.length) {
    const geo = store.geoDataset
    const byName = new Map(
      (store.municipalities ?? []).map((m) => [m.name.toLowerCase(), m.id])
    )
    store.selectedMunicipalityIds = wantedMunicipalities
      .map((entry) => (geo?.byId.has(entry) ? entry : byName.get(entry.toLowerCase())))
      .filter(Boolean)
  }
  const wantedParkings = parseList(props.parkings)
  if (wantedParkings.length && !store.selectedParkingIds.length) {
    // Station codes; the store maps them onto internal ids.
    store.selectedParkingIds = wantedParkings
  }

  // Unknown status values are dropped rather than filtering everything away.
  const wantedStatuses = parseList(props.status).filter((value) =>
    Object.values(CATEGORY).includes(value)
  )
  if (wantedStatuses.length && !selectedStatuses.value.length) {
    selectedStatuses.value = wantedStatuses
  }

  if (props.search && !store.searchTerm) store.searchTerm = props.search

  fitCamera()
})

onBeforeUnmount(() => {
  store.stopPolling()
  urlState?.stop()
  observer?.disconnect()
  observer = null
  if (clock) clearInterval(clock)
  clock = null
})

watch(() => [props.language, props.liveMaxAge, props.staleMaxAge, props.showStatic], applyConfig)

/**
 * Recentre whenever the user changes what they have selected.
 *
 * Keyed on the contents rather than the array identity, and covering every
 * facet — watching only the municipality array meant picking specific parkings,
 * an origin or a status left the camera where it was. Deliberately not keyed on
 * the parking list itself, or the map would jump on every 60-second poll.
 */
const selectionKey = computed(() =>
  [
    store.selectedMunicipalityIds.join(','),
    store.selectedParkingIds.join(','),
    store.selectedOrigins.join(','),
    selectedStatuses.value.join(','),
  ].join('|')
)

watch(selectionKey, () => {
  // Let the filtered list settle before measuring what to frame.
  nextTick(fitCamera)
})
</script>

<style>
.app {
  display: grid;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--color-surface);
}

/* Results column is sized to hold LIST_COLUMNS cards side by side. */
.app--wide {
  grid-template-columns: 40rem 1fr;
}

.app--medium {
  grid-template-columns: 20rem 1fr;
}

.app--narrow {
  grid-template-columns: 1fr;
}

/* Results column */
.panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--color-surface-sunken);
  border-right: 1px solid var(--color-border);
}

.panel-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.panel-foot {
  padding: 0.625rem 0.875rem;
  font-size: 0.75rem;
  background: var(--color-surface);
  border-top: 1px solid var(--color-border);
}

.panel-foot a {
  color: var(--color-ink-muted);
  text-decoration: none;
}

.panel-foot a:hover {
  color: var(--color-primary-strong);
}

.parking-search {
  width: calc(100% - 1.75rem);
  margin: 0 0.875rem;
  padding: 0.5rem 0.625rem;
  font: inherit;
  font-size: 0.875rem;
  color: inherit;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.parking-search:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: -1px;
}

.list {
  display: grid;
  grid-template-columns: repeat(var(--list-columns, 1), minmax(0, 1fr));
  gap: 0.5rem;
  align-content: start;
  padding: 0.75rem;
}

.notice {
  padding: 1.5rem 1rem;
  font-size: 0.875rem;
  color: var(--color-ink-muted);
  text-align: center;
}

.load-more {
  grid-column: 1 / -1;
  padding: 0.625rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--color-primary-strong);
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

/* Map + the filter bar that floats on it */
.map {
  position: relative;
  min-height: 0;
}

.filter-bar {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  max-width: calc(100% - 1.5rem);
}

.filter-slot {
  position: relative;
}

.filter-pop {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 30;
}

.sheet-head {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
}

.app--narrow .map {
  grid-area: 1 / 1;
}

.app--narrow .sheet {
  grid-area: 1 / 1;
}
</style>
