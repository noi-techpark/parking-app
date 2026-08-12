// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/**
 * Runs the real data pipeline against the live Open Data Hub API and prints
 * what the app would show. Not part of `yarn test` — it hits the network — but
 * it is the fastest way to see whether an upstream change has broken an
 * assumption, and it is what verifies the numbers quoted in the README.
 *
 *   yarn verify:live                # production API
 *   ENVIRONMENT=test yarn verify:live
 */

import {
  fetchStationMetadata,
  fetchStationValues,
  fetchSensors,
} from '../src/api/mobility.js'
import { fetchParkingPois } from '../src/api/tourism.js'
import {
  buildStationIndex,
  applyStationValues,
  normalizeSensors,
  normalizePois,
} from '../src/lib/normalize.js'
import {
  AVAILABILITY_KIND,
  CATEGORY,
  classify,
  availabilityLevel,
} from '../src/lib/availability.js'
import { parseDuration } from '../src/lib/duration.js'
import {
  createDataset,
  createMunicipalityResolver,
  municipalityDisplayName,
} from '../src/lib/geo/municipalities.js'
import { MOBILITY_BASE_URL } from '../src/lib/config.js'

import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

/** Node reads the bundled boundary files directly; the browser imports them. */
async function loadDataset() {
  const dir = fileURLToPath(new URL('../src/assets/data/', import.meta.url))
  const [topo, index] = await Promise.all([
    readFile(`${dir}municipalities.topo.json`, 'utf8').then(JSON.parse),
    readFile(`${dir}municipalities.index.json`, 'utf8').then(JSON.parse),
  ])
  return createDataset(topo, index)
}

const now = Date.now()
const staleMaxAge = parseDuration('6mo')
const liveMaxAge = parseDuration('30m')

const tally = (items, key) => {
  const counts = new Map()
  for (const item of items) {
    const k = key(item) ?? '(none)'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

const table = (rows, pad = 34) =>
  rows.map(([k, v]) => `  ${String(k).padEnd(pad)} ${v}`).join('\n')

console.log(`API: ${MOBILITY_BASE_URL}\n`)

const started = Date.now()
const [metadataRows, valueRows, sensorRows, poiItems, geo] = await Promise.all([
  fetchStationMetadata({ staleMaxAge, now }),
  fetchStationValues({ staleMaxAge, now }),
  fetchSensors({ staleMaxAge, now }),
  fetchParkingPois().catch(() => []),
  loadDataset(),
])
console.log(`fetched in ${Date.now() - started} ms`)

const resolve = createMunicipalityResolver(geo)

const raw = [
  ...applyStationValues(buildStationIndex(metadataRows), valueRows),
  ...normalizeSensors(sensorRows),
  ...normalizePois(poiItems, 'en'),
]

let dropped = 0
const parkings = []
for (const parking of raw) {
  const category = classify(parking, { now, liveMaxAge, staleMaxAge })
  if (category === CATEGORY.DROPPED) {
    dropped++
    continue
  }
  const hit =
    parking.coord?.lon != null
      ? resolve(parking.id, parking.coord.lon, parking.coord.lat)
      : null
  parkings.push({
    ...parking,
    category,
    municipalityId: hit?.id ?? null,
    municipalityName: hit
      ? municipalityDisplayName(geo.byId.get(hit.id), 'it')
      : null,
    municipalityApprox: hit?.approx ?? false,
  })
}

console.log(`\nparkings: ${parkings.length} (dropped past retention: ${dropped})`)

console.log('\nby source:\n' + table(tally(parkings, (p) => p.source)))
console.log('\nby availability kind:\n' + table(tally(parkings, (p) => p.availabilityKind)))
console.log('\nby category:\n' + table(tally(parkings, (p) => p.category)))
console.log('\nby origin:\n' + table(tally(parkings, (p) => p.origin)))

const unassigned = parkings.filter((p) => !p.municipalityId)
const approx = parkings.filter((p) => p.municipalityApprox)
const municipalities = new Set(parkings.map((p) => p.municipalityId).filter(Boolean))
console.log(
  `\nmunicipalities represented: ${municipalities.size}` +
    `\nunassigned parkings:        ${unassigned.length}` +
    `\napproximate assignments:    ${approx.length}`
)
if (unassigned.length) {
  console.log(
    '  e.g. ' +
      unassigned
        .slice(0, 5)
        .map((p) => `${p.name} (${p.coord.lon},${p.coord.lat})`)
        .join(' | ')
  )
}

console.log(
  '\ntop municipalities:\n' +
    table(tally(parkings.filter((p) => p.municipalityId), (p) => p.municipalityName).slice(0, 12))
)

// The regression this rebuild exists to fix: SBB stations used to render as
// green pins labelled "undefined" because they publish no `free` count.
const sbb = parkings.filter((p) => p.origin === 'SBB')
const sbbBroken = sbb.filter(
  (p) => p.availabilityKind === AVAILABILITY_KIND.COUNT && !Number.isFinite(p.free)
)
console.log(
  `\nSBB stations: ${sbb.length}` +
    `\n  with an occupancy ratio: ${sbb.filter((p) => Number.isFinite(p.occupancyRatio)).length}` +
    `\n  with a coarse level:     ${sbb.filter((p) => p.occupancyLevel).length}` +
    `\n  in a Swiss municipality: ${sbb.filter((p) => geo.byId.get(p.municipalityId)?.c === 'CH').length}` +
    `\n  broken (count, no value): ${sbbBroken.length}`
)

const sentinel = parkings.filter((p) => p.capacitySentinel)
console.log(`\n9999-sentinel stations: ${sentinel.length} (all forced to no-availability)`)
console.log(
  '  ' + sentinel.slice(0, 3).map((p) => `${p.name} -> ${p.availabilityKind}`).join('\n  ')
)

console.log('\nsample of what the list shows first:')
for (const parking of parkings.slice(0, 8)) {
  const value =
    parking.availabilityKind === AVAILABILITY_KIND.COUNT
      ? `${parking.free}/${parking.capacity ?? '?'} free`
      : parking.availabilityKind === AVAILABILITY_KIND.RATIO
        ? `${Math.round((1 - parking.occupancyRatio) * 100)}% free`
        : parking.availabilityKind === AVAILABILITY_KIND.LEVEL
          ? `occupancy ${parking.occupancyLevel}`
          : 'no live data'
  console.log(
    `  ${(parking.name ?? '?').slice(0, 38).padEnd(40)} ${value.padEnd(18)} ` +
      `${parking.category.padEnd(8)} ${availabilityLevel(parking).padEnd(8)} ${parking.municipalityName ?? '-'}`
  )
}
