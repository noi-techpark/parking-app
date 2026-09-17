// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import { STACK, stackMode, clickAction, fanOffset, stackKey } from '@/lib/map-stack.js'

const CLUSTER_MAX_ZOOM = 13
const mode = (memberCount, zoom, spiderfied = false) =>
  stackMode({ memberCount, zoom, clusterMaxZoom: CLUSTER_MAX_ZOOM, spiderfied })

describe('stackMode', () => {
  it('draws a lone marker normally at any zoom', () => {
    expect(mode(1, 5)).toBe(STACK.SINGLE)
    expect(mode(1, 18)).toBe(STACK.SINGLE)
  })

  it('clusters when zoomed out', () => {
    expect(mode(40, 8)).toBe(STACK.CLUSTER)
    expect(mode(2, CLUSTER_MAX_ZOOM - 1)).toBe(STACK.CLUSTER)
  })

  it('collapses overlapping markers onto their true position once zoomed in', () => {
    // The point of the change: no permanent displacement.
    expect(mode(2, CLUSTER_MAX_ZOOM)).toBe(STACK.STACK)
    expect(mode(4, 17)).toBe(STACK.STACK)
  })

  it('only fans out the stack the user opened', () => {
    expect(mode(4, 17, true)).toBe(STACK.SPIDER)
    expect(mode(4, 17, false)).toBe(STACK.STACK)
  })
})

describe('clickAction', () => {
  it('maps each drawing mode to what a click means', () => {
    expect(clickAction(STACK.SINGLE)).toBe('select')
    expect(clickAction(STACK.CLUSTER)).toBe('zoom')
    expect(clickAction(STACK.STACK)).toBe('expand')
    expect(clickAction(STACK.SPIDER)).toBe('select-member')
  })
})

describe('fanOffset', () => {
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])
  const slots = (total) => Array.from({ length: total }, (_, i) => fanOffset(i, total))
  const closestPair = (points) => {
    let min = Infinity
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) min = Math.min(min, dist(points[i], points[j]))
    return min
  }

  it('leaves a lone marker exactly where it belongs', () => {
    expect(fanOffset(0, 1)).toEqual([0, 0])
  })

  it('separates every marker by a clickable distance', () => {
    // Pixel-space, so this holds at every zoom — the old geographic offset was
    // a fixed ~3.5 m and stayed sub-pixel until absurd zoom.
    for (const total of [2, 3, 5, 8, 12, 20]) {
      expect(closestPair(slots(total)), `${total} stacked`).toBeGreaterThan(12)
    }
  })

  it('switches from a circle to a spiral past eight', () => {
    const eight = slots(8).map((p) => Math.hypot(...p))
    // A circle: every marker the same distance out.
    expect(Math.max(...eight) - Math.min(...eight)).toBeLessThan(0.001)

    const twelve = slots(12).map((p) => Math.hypot(...p))
    // A spiral: each one further out than the last.
    expect(Math.max(...twelve)).toBeGreaterThan(Math.min(...twelve) + 20)
  })
})

describe('stackKey', () => {
  it('is stable regardless of member order', () => {
    expect(stackKey(['b', 'a', 'c'])).toBe(stackKey(['c', 'b', 'a']))
  })

  it('distinguishes different groups', () => {
    expect(stackKey(['a', 'b'])).not.toBe(stackKey(['a', 'c']))
  })
})
