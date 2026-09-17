// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { feature } from 'topojson-client'

import { resolveWith } from './resolver.js'
import { geometryCentroid, unionBBox } from './polygon.js'

/**
 * Municipality boundaries, derived from OpenStreetMap `admin_level=8`.
 * ODbL-1.0 — © OpenStreetMap contributors.
 *
 * The dataset is behind a dynamic import so the geometry is decoded only once
 * something actually needs grouping — parkings render on the map immediately,
 * municipality filters appear a beat later.
 */

let loading = null

/**
 * Decodes the boundary topology into a queryable dataset.
 *
 * Kept separate from loading so the node-side tooling (which reads the files
 * from disk) and the browser (which imports them through the bundler) share one
 * implementation.
 */
export function createDataset(topo, index, overrides = null) {
  const { features } = feature(topo, topo.objects.lau)

  return {
    index,
    features,
    byId: new Map(index.map((entry) => [entry.id, entry])),
    geometryById: new Map(features.map((f) => [f.properties.id, f.geometry])),
    resolve: resolveWith(features, index, { overrides }),
  }
}

export function loadMunicipalities() {
  if (loading) return loading

  // No `with { type: 'json' }` here: the bundler serves these as JS modules and
  // the attribute makes the browser reject them. Node-side callers read the
  // files themselves and go through createDataset instead.
  loading = Promise.all([
    import('../../assets/data/municipalities.topo.json'),
    import('../../assets/data/municipalities.index.json'),
    import('../../assets/data/municipalities.overrides.json'),
  ])
    .then(([topoModule, indexModule, overridesModule]) =>
      createDataset(
        topoModule.default ?? topoModule,
        indexModule.default ?? indexModule,
        overridesModule.default ?? overridesModule
      )
    )
    .catch((err) => {
      // Let a later call retry rather than caching a rejected promise forever.
      loading = null
      throw err
    })

  return loading
}

// Tried in order once the requested locale has no name of its own. South Tyrol
// and Romandy are the bilingual areas this app actually covers.
const NAME_FALLBACKS = ['de', 'it', 'fr', 'en', 'lld']

/**
 * Longer than this, a raw OSM `name` is almost always several languages
 * concatenated — "Santa Cristina Gherdëina - St. Christina in Gröden - Santa
 * Cristina Valgardena" — which is unusable as a filter chip.
 */
const CONCATENATED_NAME_LENGTH = 30

/**
 * Picks the best label for a municipality.
 *
 * Short names are left alone: `Bolzano - Bozen` is the official bilingual form
 * and what locals expect to read. Only the long concatenations get reduced to a
 * single language.
 */
export function municipalityDisplayName(entry, locale = 'en') {
  if (!entry) return null
  if (entry.nm?.[locale]) return entry.nm[locale]
  if (entry.n.length <= CONCATENATED_NAME_LENGTH) return entry.n

  for (const lang of NAME_FALLBACKS) {
    if (entry.nm?.[lang]) return entry.nm[lang]
  }
  // No per-language variant recorded: take the first segment.
  return entry.n.split(/\s+[-–]\s+|\//)[0].trim()
}

/** Test seam: drops the cached dataset so a fresh load can be asserted. */
export function resetMunicipalities() {
  loading = null
}

/**
 * Resolves many coordinates at once, caching by a caller-supplied key (the
 * station code) so the 60-second refresh never repeats the work.
 */
export function createMunicipalityResolver(dataset) {
  const cache = new Map()

  return function resolveCached(key, lon, lat) {
    if (key != null && cache.has(key)) return cache.get(key)
    const result = dataset.resolve(lon, lat)
    if (key != null) cache.set(key, result)
    return result
  }
}

/** Union bounding box of the given municipalities, as [minLon,minLat,maxLon,maxLat]. */
export function boundsOf(dataset, ids) {
  return unionBBox(ids.map((id) => dataset.byId.get(id)?.b).filter(Boolean))
}

/**
 * Area-weighted centroid of several municipalities.
 *
 * The camera centres here and takes its zoom from the union extent, so the
 * centroid never leaves part of the selection off screen.
 */
export function compositeCentroidOf(dataset, ids) {
  const centroids = ids
    .map((id) => {
      const geometry = dataset.geometryById.get(id)
      if (!geometry) return null
      const entry = dataset.byId.get(id)
      const [minX, minY, maxX, maxY] = entry.b
      // bbox area is a cheap, monotonic stand-in for polygon area here
      const weight = Math.max((maxX - minX) * (maxY - minY), 1e-9)
      return { point: geometryCentroid(geometry), weight }
    })
    .filter(Boolean)

  if (!centroids.length) return null

  let x = 0
  let y = 0
  let total = 0
  for (const { point, weight } of centroids) {
    x += point[0] * weight
    y += point[1] * weight
    total += weight
  }
  return [x / total, y / total]
}
