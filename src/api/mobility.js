// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { MOBILITY_BASE_URL, API_ORIGIN } from '../lib/config.js'
import { LIST_DATATYPES } from '../lib/normalize.js'

/**
 * Open Data Hub mobility API (timeseries).
 *
 * Three deliberate economies, measured against the live API:
 *
 * 1. Only the instantaneous datatypes are requested. Forecast rows were most of
 *    the old 11.2 MB response, each repeating the station's whole metadata blob;
 *    they are now fetched per station when a detail view opens.
 * 2. Station metadata and station readings are fetched separately, and only the
 *    readings are polled. Metadata is static; readings are ~200 kB.
 * 3. Readings older than the retention window are dropped server-side.
 *
 * Net effect on the recurring request: 11.2 MB -> ~200 kB.
 */

// Selecting nested metadata paths instead of the whole `smetadata` blob takes
// the one-time metadata fetch from 6.1 MB to 846 kB: SBB publishes pricing
// models, opening hours and marketing copy per station, none of which is used.
// The API returns these flattened as "smetadata.capacity" keys — see
// normalize.js, which reads both the flat and the nested shape.
const METADATA_SELECT = [
  'scode',
  'sname',
  'scoordinate',
  'sorigin',
  'stype',
  'smetadata.capacity',
  'smetadata.capacities',
  'smetadata.municipality',
  'smetadata.standard_name',
  'smetadata.group',
  'smetadata.displayName',
  'smetadata.address.city',
].join(',')

/**
 * 379 SBB facilities publish only `predictedForecastedOccupancy`, whose value
 * is an empty `{predictions: []}` object. They carry no availability, but they
 * are real places to park, so they are included in the *metadata* query to
 * appear as static locations — and deliberately excluded from the polled values
 * query, where their prediction payloads would cost 2.9 MB a minute for nothing.
 */
const METADATA_DATATYPES = [...LIST_DATATYPES, 'predictedForecastedOccupancy']

// `mperiod` is carried because one station publishes two competing timeseries
// and the superseded one is identified by its period. See normalize.js.
const VALUES_SELECT = ['scode', 'mvalidtime', 'mvalue', 'tname', 'mperiod'].join(
  ','
)

const FORECAST_SELECT = ['scode', 'mvalue', 'mperiod', 'tname', 'ttype'].join(',')

/** The API compares `mvalidtime` against a plain `YYYY-MM-DD` boundary. */
function apiDate(ms) {
  return new Date(ms).toISOString().slice(0, 10)
}

/**
 * Quotes and percent-encodes a filter value.
 *
 * Both halves matter. Values containing `:` or `.` (skidata urns) have to be
 * quoted, and the quotes themselves — plus any `+` in a regex — have to be
 * encoded, or the API answers 400: an unencoded `+` in a query string is
 * decoded as a space.
 */
function quoteFilterValue(value) {
  return encodeURIComponent(`"${String(value).replace(/"/g, '\\"')}"`)
}

async function getJson(url, { signal } = {}) {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Mobility API ${response.status} for ${new URL(url).pathname}`)
  }
  return response.json()
}

/**
 * Shared filter: active stations, instantaneous datatypes only, and — when a
 * retention window is configured — nothing older than it.
 */
function listConditions({ staleMaxAge, now, datatypes }) {
  const conditions = ['sactive.eq.true', `tname.in.(${datatypes.join(',')})`]
  if (Number.isFinite(staleMaxAge)) {
    conditions.push(`mvalidtime.gt.${apiDate(now - staleMaxAge)}`)
  }
  return `and(${conditions.join(',')})`
}

/**
 * Station identity: name, position, capacity, operator. Static, so this is
 * fetched once and refreshed rarely rather than on every poll.
 */
export async function fetchStationMetadata({
  staleMaxAge = null,
  now = Date.now(),
  signal,
} = {}) {
  const url =
    `${MOBILITY_BASE_URL}/v2/flat,node/ParkingStation/*/latest` +
    `?limit=-1&select=${METADATA_SELECT}` +
    `&where=${listConditions({ staleMaxAge, now, datatypes: METADATA_DATATYPES })}` +
    `&origin=${API_ORIGIN}`

  const payload = await getJson(url, { signal })
  return payload?.data ?? []
}

/** The part that actually changes: current readings per station. Polled. */
export async function fetchStationValues({
  staleMaxAge = null,
  now = Date.now(),
  signal,
} = {}) {
  const url =
    `${MOBILITY_BASE_URL}/v2/flat,node/ParkingStation/*/latest` +
    `?limit=-1&select=${VALUES_SELECT}` +
    `&where=${listConditions({ staleMaxAge, now, datatypes: LIST_DATATYPES })}` +
    `&origin=${API_ORIGIN}`

  const payload = await getJson(url, { signal })
  return payload?.data ?? []
}

/** On-street bay sensors; each reports an `occupied` bit. */
export async function fetchSensors({
  staleMaxAge = null,
  now = Date.now(),
  signal,
} = {}) {
  const conditions = ['sactive.eq.true', 'tname.eq.occupied']
  if (Number.isFinite(staleMaxAge)) {
    conditions.push(`mvalidtime.gt.${apiDate(now - staleMaxAge)}`)
  }

  const url =
    `${MOBILITY_BASE_URL}/v2/flat,node/ParkingSensor/*/latest` +
    `?limit=-1&select=sname,scoordinate,scode,smetadata,stype,sorigin,mvalidtime,mvalue,tname` +
    `&where=and(${conditions.join(',')})` +
    `&origin=${API_ORIGIN}`

  const payload = await getJson(url, { signal })
  return payload?.data ?? []
}

/**
 * Every station's headline forecast, in one request.
 *
 * Only 83 stations publish forecasts at all, and with a lean select the whole
 * set is ~100 kB — cheap enough to show a sparkline on every list card rather
 * than fetching per station. Forecasts are hourly predictions, so this is
 * refreshed on the slow cadence rather than with each poll.
 */
export async function fetchForecasts({ signal } = {}) {
  const url =
    `${MOBILITY_BASE_URL}/v2/flat,node/ParkingStation/*/latest` +
    `?limit=-1&select=${FORECAST_SELECT}` +
    `&where=and(sactive.eq.true,tname.re.${quoteFilterValue('^parking-forecast-[0-9]+$')})` +
    `&origin=${API_ORIGIN}`

  const payload = await getJson(url, { signal })
  return payload?.data ?? []
}

/**
 * The low/high confidence band for one station, fetched when its detail opens.
 * Pulling the bands for every station would triple the payload to 338 kB for
 * something only the detail chart draws.
 */
export async function fetchForecastBand(scode, { signal } = {}) {
  const url =
    `${MOBILITY_BASE_URL}/v2/flat,node/ParkingStation/*/latest` +
    `?limit=-1&select=${FORECAST_SELECT}` +
    `&where=and(sactive.eq.true,scode.eq.${quoteFilterValue(scode)})` +
    `&origin=${API_ORIGIN}`

  const payload = await getJson(url, { signal })
  return (payload?.data ?? []).filter((row) => row.ttype === 'Forecast')
}
