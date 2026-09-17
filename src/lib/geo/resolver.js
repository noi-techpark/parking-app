// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { pointInGeometry, bboxContains, haversineKm } from './polygon.js'

const GRID_CELL_DEG = 0.1
// Beyond this a "nearest municipality" guess stops being meaningful and the
// parking is better shown as unassigned than filed under the wrong town.
const MAX_APPROX_KM = 15

const cellKey = (gx, gy) => `${gx}:${gy}`

/**
 * Key for the build-time exact-assignment map. Five decimals is roughly a
 * metre, well inside the precision the upstream feeds publish.
 */
export function overrideKey(lon, lat) {
  return `${lon.toFixed(5)},${lat.toFixed(5)}`
}

/**
 * Builds a point -> municipality resolver over decoded GeoJSON features and
 * their precomputed index entries ({ id, n, c, b: bbox, p: centroid }).
 *
 * A uniform grid over the bounding boxes narrows ~7,000 polygons down to a
 * handful of candidates before any ray casting happens, which keeps resolving
 * a full parking set to a few milliseconds.
 *
 * Returns `(lon, lat) => { id, name, country, approx } | null`.
 */
export function resolveWith(
  features,
  index,
  { maxApproxKm = MAX_APPROX_KM, overrides = null } = {}
) {
  const grid = new Map()
  const byId = new Map(index.map((entry) => [entry.id, entry]))

  index.forEach((entry, i) => {
    const [minX, minY, maxX, maxY] = entry.b
    const gx0 = Math.floor(minX / GRID_CELL_DEG)
    const gx1 = Math.floor(maxX / GRID_CELL_DEG)
    const gy0 = Math.floor(minY / GRID_CELL_DEG)
    const gy1 = Math.floor(maxY / GRID_CELL_DEG)
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const key = cellKey(gx, gy)
        let bucket = grid.get(key)
        if (!bucket) grid.set(key, (bucket = []))
        bucket.push(i)
      }
    }
  })

  const hit = (i, approx) => ({
    id: index[i].id,
    name: index[i].n,
    country: index[i].c,
    approx,
  })

  return function resolve(lon, lat) {
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null

    /*
     * Known parkings are pinned to the answer the unsimplified boundaries give.
     *
     * The shipped geometry is simplified to keep the asset small, which nudges
     * borders by a few metres — enough to move a parking sitting right on one
     * into the neighbouring municipality. Bolzano airport did exactly that.
     */
    if (overrides) {
      const pinned = overrides[overrideKey(lon, lat)]
      if (pinned) {
        const entry = byId.get(pinned)
        if (entry) {
          return { id: entry.id, name: entry.n, country: entry.c, approx: false }
        }
      }
    }

    const candidates =
      grid.get(
        cellKey(Math.floor(lon / GRID_CELL_DEG), Math.floor(lat / GRID_CELL_DEG))
      ) ?? []

    for (const i of candidates) {
      if (!bboxContains(index[i].b, lon, lat)) continue
      if (pointInGeometry(lon, lat, features[i].geometry)) return hit(i, false)
    }

    // Just outside every polygon — coastline generalisation, a boundary sliver,
    // or genuinely outside the bundled area. Fall back to the nearest centroid
    // and mark the result as approximate so the UI can say so.
    let bestIndex = -1
    let bestKm = Infinity
    for (let i = 0; i < index.length; i++) {
      const km = haversineKm([lon, lat], index[i].p)
      if (km < bestKm) {
        bestKm = km
        bestIndex = i
      }
    }
    if (bestIndex >= 0 && bestKm <= maxApproxKm) return hit(bestIndex, true)
    return null
  }
}
