// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * How a group of markers sharing one cluster should be drawn, and what a click
 * on it means. Pure so it can be tested without a map: the rendering itself
 * needs a canvas, but the rules are what actually decide behaviour.
 *
 * Follows the OverlappingMarkerSpiderfier convention — overlapping markers hold
 * their true position until clicked, then fan out with legs back to it.
 */

export const STACK = {
  /** One marker, drawn normally. */
  SINGLE: 'single',
  /** Zoomed out: a count bubble that zooms in when clicked. */
  CLUSTER: 'cluster',
  /** Overlapping markers, collapsed on their true position. */
  STACK: 'stack',
  /** The one stack the user opened: fanned out, with legs. */
  SPIDER: 'spider',
}

export function stackMode({ memberCount, zoom, clusterMaxZoom, spiderfied = false }) {
  if (memberCount <= 1) return STACK.SINGLE
  if (zoom < clusterMaxZoom) return STACK.CLUSTER
  return spiderfied ? STACK.SPIDER : STACK.STACK
}

/** What a click does, given how the group is currently drawn. */
export function clickAction(mode) {
  switch (mode) {
    case STACK.SINGLE:
      return 'select'
    case STACK.CLUSTER:
      return 'zoom'
    case STACK.STACK:
      return 'expand'
    default:
      return 'select-member'
  }
}

/**
 * Where each marker of an expanded stack sits, in pixels from the true point.
 * A circle up to eight, an Archimedean spiral beyond — the same construction
 * Leaflet.markercluster uses, whose parameters hold the gap between adjacent
 * feet roughly constant however long the spiral gets.
 */
const CIRCLE_LIMIT = 8
const SPIRAL_FOOT_SEPARATION = 26
const SPIRAL_START_RADIUS = 22
const SPIRAL_GROWTH = 5

export function fanOffset(index, total) {
  if (total < 2) return [0, 0]

  if (total <= CIRCLE_LIMIT) {
    const radius = Math.min(34, 13 + total * 4)
    const angle = -Math.PI / 2 + (index * 2 * Math.PI) / total
    return [Math.cos(angle) * radius, Math.sin(angle) * radius]
  }

  // The radius depends on every step before it, so walk the spiral out.
  let radius = SPIRAL_START_RADIUS
  let angle = 0
  for (let i = 0; i <= index; i++) {
    angle += SPIRAL_FOOT_SEPARATION / radius + i * 0.0005
    if (i < index) radius += (2 * Math.PI * SPIRAL_GROWTH) / angle
  }
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
}

/** Stable across re-clustering, so an open spider survives a data refresh. */
export const stackKey = (ids) => [...ids].sort().join('|')
