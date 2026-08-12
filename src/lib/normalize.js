// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { AVAILABILITY_KIND } from './availability.js'

/**
 * Turns the three very different upstream shapes into one parking model.
 *
 * The Open Data Hub aggregates operators that disagree about almost everything:
 * some report free spaces, some report occupancy percentages, some report
 * nothing but a location. `availabilityKind` is what lets the rest of the app
 * stop caring which.
 */

/** Capacity sentinel meaning "the operator did not tell us". */
export const SENTINEL_CAPACITY = 9999

export const DATATYPE = {
  FREE: 'free',
  FREE_SHORT_STAY: 'free_short_stay',
  OCCUPIED: 'occupied',
  SBB_RATIO: 'currentEstimatedOccupancy',
  SBB_LEVEL: 'currentEstimatedOccupancyLevel',
}

/**
 * The only datatypes the list view needs. Everything else in the response was
 * forecast rows, each repeating the station's full metadata blob.
 */
export const LIST_DATATYPES = [
  DATATYPE.FREE,
  DATATYPE.FREE_SHORT_STAY,
  DATATYPE.OCCUPIED,
  DATATYPE.SBB_RATIO,
  DATATYPE.SBB_LEVEL,
]

/**
 * The API returns `2026-05-30 03:15:02.000+0000`, which is not ISO 8601.
 * V8 happens to parse it; other engines are entitled not to. Normalise first.
 */
export function parseApiDate(value) {
  if (!value) return null
  const iso = String(value)
    .replace(' ', 'T')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const time = Date.parse(iso)
  return Number.isFinite(time) ? time : null
}

/**
 * Reads a station metadata field.
 *
 * The metadata request selects nested paths to avoid pulling SBB's entire
 * marketing payload, and the API returns those flattened as `"smetadata.capacity"`
 * keys rather than a nested object. Sensor responses still carry a real nested
 * `smetadata`, so both shapes have to work.
 */
function metaField(row, path) {
  const flat = row?.[`smetadata.${path}`]
  if (flat !== undefined) return flat
  return path.split('.').reduce((value, key) => value?.[key], row?.smetadata)
}

/**
 * SBB publishes a per-category breakdown instead of a single number, and the
 * categories are additive (19 STANDARD + 1 DISABLED = 20 spaces).
 */
function capacityOf(row) {
  const capacities = metaField(row, 'capacities')
  if (Array.isArray(capacities)) {
    const total = capacities.reduce(
      (sum, entry) => sum + (Number(entry?.total) || 0),
      0
    )
    return total > 0 ? total : null
  }
  const capacity = Number(metaField(row, 'capacity'))
  return Number.isFinite(capacity) ? capacity : null
}

function nameOf(row) {
  return (
    metaField(row, 'standard_name') ||
    row.sname ||
    metaField(row, 'displayName') ||
    metaField(row, 'group') ||
    null
  )
}

/**
 * https://github.com/noi-techpark/parking-app/issues/24
 * skidata_dynamicdata publishes both a total `free` and a `free_short_stay`;
 * only the latter reflects what a visitor can actually park in. Deliberately
 * scoped to that one origin, as it always has been — plain `skidata` also
 * exposes `free_short_stay` but its `free` is the correct headline number.
 */
function prefersShortStay(origin) {
  return origin === 'skidata_dynamicdata'
}

/**
 * Stale duplicate timeseries for the Laurin garage: it moved from a 300s to a
 * 600s period and both remain active, so the discontinued one has to be
 * ignored or it wins by arriving first.
 */
function isSupersededRow(row) {
  return row.scode === '105' && row.mperiod === 300
}

/**
 * Builds the static half of a station from the metadata response: identity,
 * position and capacity. Fetched once, because none of it changes minute to
 * minute — see api/mobility.js for why that split matters.
 */
export function buildStationIndex(metadataRows = []) {
  const byCode = new Map()

  for (const row of metadataRows) {
    if (!row?.scode || byCode.has(row.scode)) continue

    const rawCapacity = capacityOf(row)
    // Two situations that must not be conflated: the operator never published
    // a capacity, versus the operator published the 9999 sentinel meaning "we
    // have no idea". Only the sentinel invalidates the real-time reading.
    const capacitySentinel =
      rawCapacity !== null && rawCapacity >= SENTINEL_CAPACITY
    const capacity = capacitySentinel ? null : rawCapacity

    byCode.set(row.scode, {
      id: `station:${row.scode}`,
      scode: row.scode,
      source: 'station',
      origin: row.sorigin ?? null,
      name: nameOf(row),
      coord: {
        lon: row.scoordinate?.x ?? null,
        lat: row.scoordinate?.y ?? null,
      },
      // Some origins carry a municipality string; it is inconsistently spelled
      // across operators, so it is only ever a display hint — grouping is done
      // geometrically.
      municipalityHint:
        metaField(row, 'municipality') ?? metaField(row, 'address.city') ?? null,
      capacity,
      capacityUnknown: capacity === null,
      capacitySentinel,
    })
  }

  return byCode
}

/**
 * Folds the polled readings onto the station index, producing the parkings the
 * app renders. Rows arrive one per (station, datatype).
 */
export function applyStationValues(index, valueRows = []) {
  const stations = new Map()

  const stationFor = (scode) => {
    let station = stations.get(scode)
    if (station) return station

    const base = index.get(scode)
    if (!base) return null

    station = {
      ...base,
      free: null,
      occupancyRatio: null,
      occupancyLevel: null,
      lastUpdate: null,
      forecast: null,
      _freeSource: null,
    }
    stations.set(scode, station)
    return station
  }

  for (const row of valueRows) {
    if (!row?.scode || isSupersededRow(row)) continue

    const station = stationFor(row.scode)
    if (!station) continue

    const timestamp = parseApiDate(row.mvalidtime)
    if (timestamp !== null && (station.lastUpdate === null || timestamp > station.lastUpdate)) {
      station.lastUpdate = timestamp
    }

    const value = row.mvalue

    switch (row.tname) {
      case DATATYPE.FREE:
        // Only fill from `free` if a preferred short-stay value has not landed.
        if (station._freeSource !== DATATYPE.FREE_SHORT_STAY && Number.isFinite(value)) {
          station.free = Math.round(value)
          station._freeSource = DATATYPE.FREE
        }
        break

      case DATATYPE.FREE_SHORT_STAY:
        if (prefersShortStay(station.origin) && Number.isFinite(value)) {
          station.free = Math.round(value)
          station._freeSource = DATATYPE.FREE_SHORT_STAY
        }
        break

      case DATATYPE.SBB_RATIO:
        // Published with unit "%" but actually a 0..1 fraction.
        if (Number.isFinite(value)) station.occupancyRatio = value
        break

      case DATATYPE.SBB_LEVEL:
        if (typeof value === 'string') station.occupancyLevel = value
        break

      default:
        break
    }
  }

  // A station present in the metadata but with no usable reading still exists;
  // it becomes a plain location rather than silently vanishing from the map.
  for (const [scode, base] of index) {
    if (stations.has(scode)) continue
    stations.set(scode, {
      ...base,
      free: null,
      occupancyRatio: null,
      occupancyLevel: null,
      lastUpdate: null,
      forecast: null,
    })
  }

  return [...stations.values()].map(finaliseKind)
}

function finaliseKind(station) {
  delete station._freeSource

  // The 9999 sentinel poisons the count: "20 free out of we-don't-know" is not
  // something to colour a marker by. These stations become plain locations,
  // which is what the original invalidRealtime flag did.
  if (station.capacitySentinel) {
    station.availabilityKind = AVAILABILITY_KIND.NONE
    return station
  }

  if (Number.isFinite(station.free)) {
    station.availabilityKind = AVAILABILITY_KIND.COUNT
  } else if (Number.isFinite(station.occupancyRatio)) {
    station.availabilityKind = AVAILABILITY_KIND.RATIO
  } else if (station.occupancyLevel) {
    station.availabilityKind = AVAILABILITY_KIND.LEVEL
  } else {
    station.availabilityKind = AVAILABILITY_KIND.NONE
  }
  return station
}

/**
 * On-street sensors report one occupied/free bit each. They are only meaningful
 * aggregated into the street segment they belong to (`smetadata.group`).
 */
export function normalizeSensors(rows = []) {
  const byGroup = new Map()

  for (const row of rows) {
    const group = row?.smetadata?.group
    if (!group) continue

    let segment = byGroup.get(group)
    if (!segment) {
      segment = {
        id: `sensorgroup:${group}`,
        scode: group,
        source: 'sensor',
        origin: row.sorigin ?? 'onstreet',
        name: group,
        coord: { lon: row.scoordinate?.x ?? null, lat: row.scoordinate?.y ?? null },
        municipalityHint: row.smetadata?.municipality ?? null,
        capacity: 0,
        capacityUnknown: false,
        capacitySentinel: false,
        free: 0,
        occupancyRatio: null,
        occupancyLevel: null,
        lastUpdate: null,
        forecast: null,
        availabilityKind: AVAILABILITY_KIND.COUNT,
      }
      byGroup.set(group, segment)
    }

    // The datatype is `occupied`, so a free bay is 1 - occupied.
    segment.capacity += 1
    if (Number.isFinite(row.mvalue)) {
      segment.free += 1 - Math.round(row.mvalue)
    }

    const timestamp = parseApiDate(row.mvalidtime)
    if (timestamp !== null && (segment.lastUpdate === null || timestamp > segment.lastUpdate)) {
      segment.lastUpdate = timestamp
    }
  }

  return [...byGroup.values()]
}

/**
 * Tourism POIs: a name and a location, nothing else. They exist so the map can
 * show where parking is even where nobody instruments it.
 */
export function normalizePois(items = [], locale = 'en') {
  const parkings = []

  for (const item of items) {
    const coordinates = item?.GpsInfo?.[0]
    if (!coordinates) continue

    const detail = item.Detail ?? {}
    const name =
      detail[locale]?.Title ?? detail.en?.Title ?? detail.de?.Title ?? detail.it?.Title

    parkings.push({
      id: `poi:${item.Id}`,
      scode: item.Id,
      source: 'poi',
      origin: 'tourism',
      name: name ?? null,
      coord: {
        lon: coordinates.Longitude ?? null,
        lat: coordinates.Latitude ?? null,
      },
      municipalityHint: null,
      capacity: null,
      capacityUnknown: true,
      capacitySentinel: false,
      free: null,
      occupancyRatio: null,
      occupancyLevel: null,
      lastUpdate: null,
      forecast: null,
      availabilityKind: AVAILABILITY_KIND.NONE,
    })
  }

  return parkings
}

/**
 * Groups the all-stations forecast response into one series per station.
 *
 * Needs the station index because forecast rows carry a predicted *occupied*
 * count, and turning that into free spaces requires each station's capacity.
 */
export function normalizeForecasts(rows = [], index = new Map()) {
  const byStation = new Map()

  for (const row of rows) {
    if (!row?.scode) continue
    let bucket = byStation.get(row.scode)
    if (!bucket) byStation.set(row.scode, (bucket = []))
    bucket.push(row)
  }

  const series = new Map()
  for (const [scode, stationRows] of byStation) {
    const capacity = index.get(scode)?.capacity
    if (!Number.isFinite(capacity)) continue
    const points = normalizeForecast(stationRows, { capacity })
    if (points.length) series.set(scode, points)
  }
  return series
}

const FORECAST_MAIN = /^parking-forecast-(\d+)$/
const FORECAST_LOW = /^parking-forecast-low-(\d+)$/
const FORECAST_HIGH = /^parking-forecast-high-(\d+)$/

/**
 * Builds the forecast series for one station.
 *
 * Forecast rows carry the predicted *occupied* count, and `mperiod` is the
 * horizon in seconds (`parking-forecast-30` has mperiod 1800). The low/high
 * bands were previously fetched and discarded; they cost nothing extra and make
 * the chart honest about its uncertainty.
 */
export function normalizeForecast(rows = [], { capacity, freeNow = null } = {}) {
  if (!Number.isFinite(capacity)) return []

  const byHorizon = new Map()
  const at = (minutes) => {
    let point = byHorizon.get(minutes)
    if (!point) byHorizon.set(minutes, (point = { minutes }))
    return point
  }

  for (const row of rows) {
    if (row?.ttype !== 'Forecast' || !Number.isFinite(row.mvalue)) continue

    const toFree = (occupied) => Math.max(0, capacity - Math.round(occupied))
    let match

    if ((match = FORECAST_MAIN.exec(row.tname))) {
      at(Number(match[1])).free = toFree(row.mvalue)
    } else if ((match = FORECAST_LOW.exec(row.tname))) {
      // A low *occupancy* bound is an upper bound on free spaces.
      at(Number(match[1])).freeHigh = toFree(row.mvalue)
    } else if ((match = FORECAST_HIGH.exec(row.tname))) {
      at(Number(match[1])).freeLow = toFree(row.mvalue)
    }
  }

  const series = [...byHorizon.values()]
    .filter((point) => Number.isFinite(point.free))
    .sort((a, b) => a.minutes - b.minutes)

  // Anchor the series at the current reading so the chart starts from now.
  if (Number.isFinite(freeNow)) {
    series.unshift({ minutes: 0, free: freeNow })
  }
  return series
}
