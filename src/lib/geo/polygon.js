// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Pure planar geometry helpers, shared by the runtime municipality resolver and
 * the build-time boundary pipeline. Coordinates are [lon, lat] degrees; at the
 * scales involved (single municipalities) treating them as planar is accurate
 * enough for containment and centroid work.
 */

/**
 * Ray-casting containment test for a single linear ring.
 * Points exactly on an edge are not guaranteed either way, which is fine: a
 * parking sitting precisely on a municipal boundary is arbitrary anyway.
 */
export function pointInRing(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** GeoJSON Polygon coordinates: [outerRing, ...holes]. */
export function pointInPolygon(lon, lat, rings) {
  if (!rings.length || !pointInRing(lon, lat, rings[0])) return false
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(lon, lat, rings[i])) return false
  }
  return true
}

/** Accepts a GeoJSON Polygon or MultiPolygon geometry. */
export function pointInGeometry(lon, lat, geometry) {
  if (!geometry) return false
  if (geometry.type === 'Polygon') {
    return pointInPolygon(lon, lat, geometry.coordinates)
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((rings) => pointInPolygon(lon, lat, rings))
  }
  return false
}

/** Signed area of a ring; positive for counter-clockwise winding. */
export function ringArea(ring) {
  let sum = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  }
  return sum / 2
}

/**
 * Area-weighted centroid of a Polygon/MultiPolygon. Falls back to the bbox
 * centre for degenerate (zero-area) geometry.
 */
export function geometryCentroid(geometry) {
  const polygons =
    geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : [geometry.coordinates]

  let cx = 0
  let cy = 0
  let total = 0

  for (const rings of polygons) {
    const ring = rings[0]
    if (!ring || ring.length < 3) continue

    let area = 0
    let x = 0
    let y = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1]
      area += cross
      x += (ring[j][0] + ring[i][0]) * cross
      y += (ring[j][1] + ring[i][1]) * cross
    }
    area /= 2
    if (area === 0) continue

    cx += x / (6 * area) * Math.abs(area)
    cy += y / (6 * area) * Math.abs(area)
    total += Math.abs(area)
  }

  if (total === 0) {
    const [minX, minY, maxX, maxY] = geometryBBox(geometry)
    return [(minX + maxX) / 2, (minY + maxY) / 2]
  }
  return [cx / total, cy / total]
}

/** [minLon, minLat, maxLon, maxLat] of a Polygon/MultiPolygon. */
export function geometryBBox(geometry) {
  const bbox = [Infinity, Infinity, -Infinity, -Infinity]
  const polygons =
    geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : [geometry.coordinates]

  for (const rings of polygons) {
    for (const ring of rings) {
      for (const [lon, lat] of ring) {
        if (lon < bbox[0]) bbox[0] = lon
        if (lat < bbox[1]) bbox[1] = lat
        if (lon > bbox[2]) bbox[2] = lon
        if (lat > bbox[3]) bbox[3] = lat
      }
    }
  }
  return bbox
}

/** Union of several [minLon, minLat, maxLon, maxLat] boxes. */
export function unionBBox(boxes) {
  const out = [Infinity, Infinity, -Infinity, -Infinity]
  for (const b of boxes) {
    if (!b) continue
    if (b[0] < out[0]) out[0] = b[0]
    if (b[1] < out[1]) out[1] = b[1]
    if (b[2] > out[2]) out[2] = b[2]
    if (b[3] > out[3]) out[3] = b[3]
  }
  return Number.isFinite(out[0]) ? out : null
}

export function bboxContains(bbox, lon, lat, pad = 0) {
  return (
    lon >= bbox[0] - pad &&
    lon <= bbox[2] + pad &&
    lat >= bbox[1] - pad &&
    lat <= bbox[3] + pad
  )
}

const EARTH_RADIUS_KM = 6371

/** Great-circle distance in kilometres. */
export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}
