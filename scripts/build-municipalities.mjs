// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/**
 * Builds the bundled municipality boundary asset.
 *
 * Source: OpenStreetMap administrative boundaries at admin_level=8, which is
 * the municipality level consistently across IT/CH/AT/DE/FR/LI. Fetched from
 * the Overpass API one country at a time, so each result's country is known by
 * construction (municipality relations carry no ISO country tag).
 *
 *   yarn geo:build [--countries=CH,IT,AT,DE,FR,LI] [--margin=0.08]
 *                  [--simplify=8%] [--strategy=near|bbox] [--refresh]
 *
 * `near`  keeps municipalities within `margin` degrees of a real parking, so
 *         the asset stays small while still covering nearby towns that may get
 *         parkings later.
 * `bbox`  keeps everything inside the overall bounding box of the data.
 *
 * Responses are cached under .geo-cache/ (~150 MB); pass --refresh to refetch.
 *
 * The output is a derived database of OpenStreetMap data and is therefore
 * licensed ODbL-1.0: © OpenStreetMap contributors.
 */

import { mkdir, readFile, writeFile, stat } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { fileURLToPath, URL } from 'node:url'

import mapshaper from 'mapshaper'
import { feature } from 'topojson-client'

import {
  geometryBBox,
  geometryCentroid,
  bboxContains,
  pointInPolygon,
} from '../src/lib/geo/polygon.js'

const OVERPASS_URL =
  process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter'

// Overpass rejects anonymous clients with 406; identify the build honestly.
const USER_AGENT =
  'noi-techpark-parking-app-geo-build/1.0 (+https://github.com/noi-techpark/parking-app)'

const CACHE_DIR = fileURLToPath(new URL('../.geo-cache/', import.meta.url))
const OUT_DIR = fileURLToPath(new URL('../src/assets/data/', import.meta.url))

const MOBILITY_HOSTS = [
  'https://mobility.api.opendatahub.com',
  'https://mobility.api.opendatahub.testingmachine.eu',
]
const CONTENT_HOSTS = [
  'https://tourism.api.opendatahub.com',
  'https://tourism.api.opendatahub.testingmachine.eu',
]

/** "Parking" tag in the Open Data Hub content taxonomy. */
const PARKING_TAG = '264369BEFCC0461C9C585C867DD0CC88'

// Languages worth carrying: the bilingual/trilingual areas this app serves.
const NAME_LANGS = ['it', 'de', 'en', 'fr', 'lld']

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .filter((a) => a.startsWith('--'))
    .map((a) => {
      const [k, v = 'true'] = a.slice(2).split('=')
      return [k, v]
    })
)

const COUNTRIES = (args.countries ?? 'CH,IT,AT,DE,FR,LI').split(',')
const STRATEGY = args.strategy ?? 'near'
const MARGIN = Number(args.margin ?? 0.08) // degrees; ~9 km of latitude
// Aggressive on purpose: the fidelity pass below pins every known parking to
// the answer the unsimplified geometry gives, so simplification only governs
// coordinates the build has never seen.
const SIMPLIFY = args.simplify ?? '3%'
const REFRESH = args.refresh === 'true'
const BUDGET_GZIP = 700_000

const log = (...m) => console.log('[geo]', ...m)
const mb = (n) => `${(n / 1e6).toFixed(2)} MB`
const kb = (n) => `${(n / 1e3).toFixed(0)} kB`

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Every coordinate the app can currently show, from prod *and* test. */
async function fetchParkingCoordinates() {
  const points = []
  const seen = new Set()
  const push = (lon, lat) => {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
    const key = `${lon.toFixed(5)},${lat.toFixed(5)}`
    if (seen.has(key)) return
    seen.add(key)
    points.push([lon, lat])
  }

  for (const host of MOBILITY_HOSTS) {
    for (const type of ['ParkingStation', 'ParkingSensor']) {
      const url =
        `${host}/v2/flat,node/${type}/*/latest` +
        `?limit=-1&where=sactive.eq.true&select=scoordinate,scode&origin=webcomp-parking-app`
      try {
        const res = await fetch(url)
        const json = await res.json()
        for (const row of json.data ?? []) {
          push(row.scoordinate?.x, row.scoordinate?.y)
        }
        log(`${type} @ ${new URL(host).hostname}: ${json.data?.length ?? 0} rows`)
      } catch (err) {
        log(`WARN ${type} @ ${host} failed: ${err.message}`)
      }
    }
  }

  for (const host of CONTENT_HOSTS) {
    const url =
      `${host}/v1/ODHActivityPoi?tagfilter=${PARKING_TAG}` +
      `&pagenumber=1&pagesize=1000&removenullvalues=true&fields=Id,GpsInfo` +
      `&origin=webcomp-parking-app`
    try {
      const res = await fetch(url)
      const json = await res.json()
      for (const item of json.Items ?? []) {
        const gps = item.GpsInfo?.[0]
        if (gps) push(gps.Longitude, gps.Latitude)
      }
      log(`POIs @ ${new URL(host).hostname}: ${json.Items?.length ?? 0} items`)
    } catch (err) {
      log(`WARN POIs @ ${host} failed: ${err.message}`)
    }
  }

  if (!points.length) {
    throw new Error('no parking coordinates fetched — refusing to build')
  }
  return points
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Posts a query to Overpass, retrying the transient failures the public
 * instance hands out under load. Overpass answers 406 to requests without a
 * User-Agent, and expects the query form-encoded.
 */
async function overpass(query, label) {
  const backoffs = [10_000, 30_000, 60_000, 120_000]

  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: query,
    })

    if (res.ok) return await res.text()

    const retryable = [429, 502, 503, 504].includes(res.status)
    if (!retryable || attempt === backoffs.length) {
      throw new Error(`Overpass failed for ${label}: HTTP ${res.status}`)
    }
    const wait = backoffs[attempt]
    log(`${label}: HTTP ${res.status}, retrying in ${wait / 1000}s…`)
    await sleep(wait)
  }
  throw new Error(`Overpass failed for ${label}: retries exhausted`)
}

async function fetchCountryBoundaries(country, bbox) {
  await mkdir(CACHE_DIR, { recursive: true })
  const cacheFile = `${CACHE_DIR}osm-${country}.json`

  if (!REFRESH && (await exists(cacheFile))) {
    log(`${country}: using cached Overpass response`)
    return JSON.parse(await readFile(cacheFile, 'utf8'))
  }

  const [minLon, minLat, maxLon, maxLat] = bbox
  const query = `[out:json][timeout:600];
area["ISO3166-1"="${country}"]["admin_level"="2"]->.a;
rel(area.a)["boundary"="administrative"]["admin_level"="8"](${minLat},${minLon},${maxLat},${maxLon});
out geom;`

  log(`${country}: querying Overpass…`)
  const text = await overpass(query, country)
  await writeFile(cacheFile, text)
  log(`${country}: ${mb(text.length)} cached`)
  return JSON.parse(text)
}

/**
 * Chains open ways into closed rings by matching endpoints. OSM boundary
 * relations store their outline as an unordered pile of ways, so this is what
 * turns them into polygons.
 */
function ringsFromWays(ways) {
  const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`
  const pool = ways.filter((w) => w.length >= 2)
  const rings = []

  while (pool.length) {
    let chain = pool.pop()
    let closed = key(chain[0]) === key(chain[chain.length - 1])
    let guard = 0

    while (!closed && guard++ < 10000) {
      const tail = key(chain[chain.length - 1])
      let found = -1
      let reversed = false
      for (let i = 0; i < pool.length; i++) {
        const w = pool[i]
        if (key(w[0]) === tail) {
          found = i
          reversed = false
          break
        }
        if (key(w[w.length - 1]) === tail) {
          found = i
          reversed = true
          break
        }
      }
      if (found < 0) break
      const [w] = pool.splice(found, 1)
      const segment = reversed ? [...w].reverse() : w
      chain = chain.concat(segment.slice(1))
      closed = key(chain[0]) === key(chain[chain.length - 1])
    }

    if (closed && chain.length >= 4) rings.push(chain)
  }
  return rings
}

function geometryFromRelation(relation) {
  const outerWays = []
  const innerWays = []

  for (const member of relation.members ?? []) {
    if (member.type !== 'way' || !member.geometry) continue
    const coords = member.geometry.map((p) => [p.lon, p.lat])
    if (member.role === 'inner') innerWays.push(coords)
    else if (member.role === 'outer' || member.role === '') outerWays.push(coords)
  }

  const outers = ringsFromWays(outerWays)
  if (!outers.length) return null

  const polygons = outers.map((ring) => [ring])
  for (const inner of ringsFromWays(innerWays)) {
    const [lon, lat] = inner[0]
    const host = polygons.find((p) => pointInPolygon(lon, lat, [p[0]]))
    ;(host ?? polygons[0]).push(inner)
  }

  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0] }
    : { type: 'MultiPolygon', coordinates: polygons }
}

function namesFrom(tags) {
  const names = {}
  for (const lang of NAME_LANGS) {
    const value = tags[`name:${lang}`]
    if (value && value !== tags.name) names[lang] = value
  }
  return Object.keys(names).length ? names : undefined
}

/** Uniform grid over the parking points, for cheap "is any point near" tests. */
function buildPointGrid(points, cell) {
  const grid = new Map()
  for (const [lon, lat] of points) {
    const key = `${Math.floor(lon / cell)}:${Math.floor(lat / cell)}`
    let bucket = grid.get(key)
    if (!bucket) grid.set(key, (bucket = []))
    bucket.push([lon, lat])
  }
  return { grid, cell }
}

function hasPointNear({ grid, cell }, bbox, margin) {
  const gx0 = Math.floor((bbox[0] - margin) / cell)
  const gx1 = Math.floor((bbox[2] + margin) / cell)
  const gy0 = Math.floor((bbox[1] - margin) / cell)
  const gy1 = Math.floor((bbox[3] + margin) / cell)
  for (let gx = gx0; gx <= gx1; gx++) {
    for (let gy = gy0; gy <= gy1; gy++) {
      for (const [lon, lat] of grid.get(`${gx}:${gy}`) ?? []) {
        if (bboxContains(bbox, lon, lat, margin)) return true
      }
    }
  }
  return false
}

async function main() {
  const points = await fetchParkingCoordinates()
  log(`${points.length} distinct parking coordinates`)

  const dataBBox = points.reduce(
    (b, [lon, lat]) => [
      Math.min(b[0], lon),
      Math.min(b[1], lat),
      Math.max(b[2], lon),
      Math.max(b[3], lat),
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  )
  const queryBBox = [
    dataBBox[0] - 0.5,
    dataBBox[1] - 0.5,
    dataBBox[2] + 0.5,
    dataBBox[3] + 0.5,
  ]
  log(`query bbox ${queryBBox.map((v) => v.toFixed(2)).join(', ')}`)

  const all = []
  const seenRelations = new Set()
  let broken = 0

  for (const country of COUNTRIES) {
    const payload = await fetchCountryBoundaries(country, queryBBox)
    let kept = 0
    for (const relation of payload.elements ?? []) {
      if (seenRelations.has(relation.id)) continue
      seenRelations.add(relation.id)

      const geometry = geometryFromRelation(relation)
      if (!geometry) {
        broken++
        continue
      }
      all.push({
        type: 'Feature',
        properties: {
          id: `osm:r${relation.id}`,
          n: relation.tags?.name ?? '',
          c: country,
          nm: namesFrom(relation.tags ?? {}),
        },
        geometry,
      })
      kept++
    }
    log(`${country}: ${kept} municipalities`)
  }
  if (broken) log(`WARN skipped ${broken} relations with unclosed geometry`)
  log(`${all.length} municipalities fetched`)

  let selected
  if (STRATEGY === 'bbox') {
    const box = [
      dataBBox[0] - MARGIN,
      dataBBox[1] - MARGIN,
      dataBBox[2] + MARGIN,
      dataBBox[3] + MARGIN,
    ]
    selected = all.filter((f) => {
      const b = geometryBBox(f.geometry)
      return b[0] <= box[2] && b[2] >= box[0] && b[1] <= box[3] && b[3] >= box[1]
    })
  } else {
    const index = buildPointGrid(points, Math.max(MARGIN, 0.05))
    selected = all.filter((f) =>
      hasPointNear(index, geometryBBox(f.geometry), MARGIN)
    )
  }
  log(`${selected.length} municipalities selected (${STRATEGY}, margin ${MARGIN}°)`)
  if (!selected.length) throw new Error('pruning selected nothing')

  const rawJson = JSON.stringify({
    type: 'FeatureCollection',
    features: selected,
  })
  log(`selected geometry: ${mb(rawJson.length)} raw GeoJSON`)

  log(`simplifying (visvalingam ${SIMPLIFY}, keep-shapes)…`)
  const out = await mapshaper.applyCommands(
    `-i in.json -simplify visvalingam ${SIMPLIFY} keep-shapes ` +
      `-o out.json format=topojson precision=0.0001`,
    { 'in.json': rawJson }
  )
  const simplified = JSON.parse(Buffer.from(out['out.json']).toString('utf8'))
  const layer = Object.keys(simplified.objects)[0]
  if (layer !== 'lau') {
    simplified.objects.lau = simplified.objects[layer]
    delete simplified.objects[layer]
  }

  // Derive the lookup index from the *simplified* geometry so runtime bboxes
  // match the polygons that will actually be tested.
  const collection = feature(simplified, simplified.objects.lau)
  const index = collection.features.map((f) => ({
    id: f.properties.id,
    n: f.properties.n,
    c: f.properties.c,
    ...(f.properties.nm ? { nm: f.properties.nm } : {}),
    b: geometryBBox(f.geometry).map((v) => Number(v.toFixed(5))),
    p: geometryCentroid(f.geometry).map((v) => Number(v.toFixed(5))),
  }))

  await mkdir(OUT_DIR, { recursive: true })
  const topoJson = JSON.stringify(simplified)
  const indexJson = JSON.stringify(index)
  await writeFile(`${OUT_DIR}municipalities.topo.json`, topoJson)
  await writeFile(`${OUT_DIR}municipalities.index.json`, indexJson)

  const topoGz = gzipSync(Buffer.from(topoJson), { level: 9 }).length
  const indexGz = gzipSync(Buffer.from(indexJson), { level: 9 }).length

  log('—'.repeat(58))
  log(`municipalities   ${index.length}`)
  log(`boundaries       ${mb(topoJson.length)} raw / ${kb(topoGz)} gzip`)
  log(`index            ${mb(indexJson.length)} raw / ${kb(indexGz)} gzip`)

  const { resolveWith, overrideKey } = await import('../src/lib/geo/resolver.js')
  const resolve = resolveWith(collection.features, index)

  // Coverage: every parking must land inside some polygon.
  let exact = 0
  const misses = []
  for (const [lon, lat] of points) {
    const hit = resolve(lon, lat)
    if (hit && !hit.approx) exact++
    else misses.push([lon, lat])
  }
  const pct = ((exact / points.length) * 100).toFixed(1)
  log(`coverage: ${exact}/${points.length} (${pct}%) resolved exactly`)
  if (misses.length) {
    log(`first misses: ${misses.slice(0, 5).map((p) => p.join(',')).join(' | ')}`)
  }

  /*
   * Fidelity: every parking must land inside the *correct* polygon.
   *
   * Coverage alone is not enough and once hid a real defect — simplification
   * had shifted the Bolzano/Laives border across Bolzano airport, so its two
   * parkings resolved to the neighbouring municipality while still counting as
   * "100% resolved". Simplification is only acceptable while it changes no
   * parking's answer, so compare against the unsimplified geometry.
   */
  const referenceIndex = selected.map((f) => ({
    id: f.properties.id,
    n: f.properties.n,
    c: f.properties.c,
    b: geometryBBox(f.geometry).map((v) => Number(v.toFixed(5))),
    p: geometryCentroid(f.geometry).map((v) => Number(v.toFixed(5))),
  }))
  const resolveReference = resolveWith(selected, referenceIndex)

  const displaced = []
  const overrides = {}
  for (const [lon, lat] of points) {
    const truth = resolveReference(lon, lat)
    const after = resolve(lon, lat)
    if (!truth || truth.approx) continue

    // Pin every known parking to the answer the *unsimplified* geometry gives.
    overrides[overrideKey(lon, lat)] = truth.id

    if ((truth.id ?? null) !== (after?.id ?? null)) {
      displaced.push({ lon, lat, from: truth.name, to: after?.name ?? 'none' })
    }
  }

  log(
    `fidelity: ${points.length - displaced.length}/${points.length} ` +
      `unchanged by simplification; ${displaced.length} pinned by override`
  )
  for (const d of displaced.slice(0, 8)) {
    log(`  pinned ${d.lon},${d.lat}: ${d.to} -> ${d.from}`)
  }

  const overridesJson = JSON.stringify(overrides)
  await writeFile(`${OUT_DIR}municipalities.overrides.json`, overridesJson)
  const overridesGz = gzipSync(Buffer.from(overridesJson), { level: 9 }).length
  log(`overrides        ${Object.keys(overrides).length} points / ${kb(overridesGz)} gzip`)

  const totalGz = topoGz + indexGz + overridesGz
  log(`total gzip       ${kb(totalGz)}`)

  if (totalGz > BUDGET_GZIP) {
    throw new Error(
      `asset budget exceeded: ${kb(totalGz)} > ${kb(BUDGET_GZIP)}. ` +
        `Re-run with a tighter --margin or a stronger --simplify.`
    )
  }
}

main().catch((err) => {
  console.error('[geo] FAILED:', err.message)
  process.exitCode = 1
})
