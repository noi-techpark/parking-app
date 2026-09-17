// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import {
  AVAILABILITY_KIND,
  CATEGORY,
  LEVEL,
  availabilityLevel,
  classify,
  compareParkings,
  freeFraction,
  levelFromFreeRatio,
} from '@/lib/availability.js'
import { parseDuration, relativeAge } from '@/lib/duration.js'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('levelFromFreeRatio', () => {
  it('bands at the documented thresholds', () => {
    expect(levelFromFreeRatio(1)).toBe(LEVEL.HIGH)
    expect(levelFromFreeRatio(0.5)).toBe(LEVEL.HIGH)
    expect(levelFromFreeRatio(0.499)).toBe(LEVEL.MID)
    expect(levelFromFreeRatio(0.2)).toBe(LEVEL.MID)
    expect(levelFromFreeRatio(0.199)).toBe(LEVEL.LOW)
    expect(levelFromFreeRatio(0)).toBe(LEVEL.LOW)
  })

  it('is unknown for non-numbers', () => {
    expect(levelFromFreeRatio(NaN)).toBe(LEVEL.UNKNOWN)
    expect(levelFromFreeRatio(null)).toBe(LEVEL.UNKNOWN)
  })
})

describe('availabilityLevel', () => {
  it('handles counted availability', () => {
    const parking = {
      availabilityKind: AVAILABILITY_KIND.COUNT,
      free: 10,
      capacity: 100,
    }
    expect(availabilityLevel(parking)).toBe(LEVEL.LOW)
    expect(availabilityLevel({ ...parking, free: 60 })).toBe(LEVEL.HIGH)
  })

  it('degrades to full/not-full when the total is unknown', () => {
    const parking = {
      availabilityKind: AVAILABILITY_KIND.COUNT,
      free: 3,
      capacity: null,
    }
    expect(availabilityLevel(parking)).toBe(LEVEL.HIGH)
    expect(availabilityLevel({ ...parking, free: 0 })).toBe(LEVEL.LOW)
  })

  it('inverts an occupancy ratio', () => {
    const parking = { availabilityKind: AVAILABILITY_KIND.RATIO }
    expect(availabilityLevel({ ...parking, occupancyRatio: 0.92 })).toBe(LEVEL.LOW)
    expect(availabilityLevel({ ...parking, occupancyRatio: 0.6 })).toBe(LEVEL.MID)
    expect(availabilityLevel({ ...parking, occupancyRatio: 0.1 })).toBe(LEVEL.HIGH)
  })

  it('inverts a coarse occupancy level', () => {
    const parking = { availabilityKind: AVAILABILITY_KIND.LEVEL }
    expect(availabilityLevel({ ...parking, occupancyLevel: 'LOW' })).toBe(LEVEL.HIGH)
    expect(availabilityLevel({ ...parking, occupancyLevel: 'MEDIUM' })).toBe(LEVEL.MID)
    expect(availabilityLevel({ ...parking, occupancyLevel: 'HIGH' })).toBe(LEVEL.LOW)
  })

  it('is unknown for static parkings', () => {
    expect(availabilityLevel({ availabilityKind: AVAILABILITY_KIND.NONE })).toBe(
      LEVEL.UNKNOWN
    )
    expect(availabilityLevel(null)).toBe(LEVEL.UNKNOWN)
  })
})

describe('freeFraction', () => {
  it('derives a fraction from either representation', () => {
    expect(
      freeFraction({
        availabilityKind: AVAILABILITY_KIND.COUNT,
        free: 25,
        capacity: 100,
      })
    ).toBeCloseTo(0.25)
    expect(
      freeFraction({
        availabilityKind: AVAILABILITY_KIND.RATIO,
        occupancyRatio: 0.25,
      })
    ).toBeCloseTo(0.75)
  })

  it('clamps nonsense into range', () => {
    expect(
      freeFraction({
        availabilityKind: AVAILABILITY_KIND.COUNT,
        free: 120,
        capacity: 100,
      })
    ).toBe(1)
  })

  it('has no answer for level-only or static parkings', () => {
    expect(
      freeFraction({ availabilityKind: AVAILABILITY_KIND.LEVEL, occupancyLevel: 'LOW' })
    ).toBeNull()
    expect(freeFraction({ availabilityKind: AVAILABILITY_KIND.NONE })).toBeNull()
  })
})

describe('classify', () => {
  const now = Date.UTC(2026, 7, 12, 12, 0, 0)
  const windows = { now, liveMaxAge: 30 * MINUTE, staleMaxAge: 180 * DAY }
  const realtime = (lastUpdate) => ({
    availabilityKind: AVAILABILITY_KIND.COUNT,
    lastUpdate,
  })

  it('calls a fresh reading live', () => {
    expect(classify(realtime(now - MINUTE), windows)).toBe(CATEGORY.LIVE)
  })

  it('holds the boundary at exactly liveMaxAge', () => {
    expect(classify(realtime(now - 30 * MINUTE), windows)).toBe(CATEGORY.LIVE)
    expect(classify(realtime(now - 30 * MINUTE - 1), windows)).toBe(CATEGORY.DELAYED)
  })

  it('drops readings past the retention window', () => {
    expect(classify(realtime(now - 179 * DAY), windows)).toBe(CATEGORY.DELAYED)
    expect(classify(realtime(now - 181 * DAY), windows)).toBe(CATEGORY.DROPPED)
  })

  it('treats a parking with no real-time capability as static', () => {
    expect(
      classify({ availabilityKind: AVAILABILITY_KIND.NONE, lastUpdate: now }, windows)
    ).toBe(CATEGORY.STATIC)
    expect(classify(realtime(null), windows)).toBe(CATEGORY.STATIC)
  })

  it('honours a widened live window', () => {
    const relaxed = { ...windows, liveMaxAge: 6 * HOUR }
    expect(classify(realtime(now - 4 * HOUR), relaxed)).toBe(CATEGORY.LIVE)
  })
})

describe('compareParkings', () => {
  const make = (over) => ({
    availabilityKind: AVAILABILITY_KIND.COUNT,
    category: CATEGORY.LIVE,
    capacity: 100,
    name: 'x',
    ...over,
  })

  it('sorts live before delayed before static', () => {
    const list = [
      make({ category: CATEGORY.STATIC, availabilityKind: AVAILABILITY_KIND.NONE }),
      make({ category: CATEGORY.DELAYED, free: 90 }),
      make({ category: CATEGORY.LIVE, free: 1 }),
    ]
    expect(list.sort(compareParkings).map((p) => p.category)).toEqual([
      CATEGORY.LIVE,
      CATEGORY.DELAYED,
      CATEGORY.STATIC,
    ])
  })

  it('puts emptier parkings first within a bucket', () => {
    const list = [make({ free: 10 }), make({ free: 80 }), make({ free: 40 })]
    expect(list.sort(compareParkings).map((p) => p.free)).toEqual([80, 40, 10])
  })

  it('falls back to name when neither has a fraction', () => {
    const list = [
      make({ availabilityKind: AVAILABILITY_KIND.NONE, name: 'Bravo' }),
      make({ availabilityKind: AVAILABILITY_KIND.NONE, name: 'Alfa' }),
    ]
    expect(list.sort(compareParkings).map((p) => p.name)).toEqual(['Alfa', 'Bravo'])
  })
})

describe('parseDuration', () => {
  it('parses the attribute forms the webcomponent accepts', () => {
    expect(parseDuration('90s')).toBe(90_000)
    expect(parseDuration('30m')).toBe(30 * MINUTE)
    expect(parseDuration('4h')).toBe(4 * HOUR)
    expect(parseDuration('7d')).toBe(7 * DAY)
    expect(parseDuration('2w')).toBe(14 * DAY)
    expect(parseDuration('6mo')).toBe(180 * DAY)
    expect(parseDuration('1y')).toBe(365 * DAY)
  })

  it('does not mistake `mo` for `m`', () => {
    expect(parseDuration('6mo')).not.toBe(6 * MINUTE)
  })

  it('accepts bare milliseconds and numbers', () => {
    expect(parseDuration('5000')).toBe(5000)
    expect(parseDuration(1234)).toBe(1234)
  })

  it('falls back rather than throwing on junk', () => {
    expect(parseDuration('soon', 42)).toBe(42)
    expect(parseDuration('', 42)).toBe(42)
    expect(parseDuration(undefined, 42)).toBe(42)
    expect(parseDuration('-5m', 42)).toBe(42)
  })
})

describe('relativeAge', () => {
  it('picks a sensible unit', () => {
    expect(relativeAge(30_000)).toEqual({ unit: 'second', value: 30 })
    expect(relativeAge(3 * MINUTE)).toEqual({ unit: 'minute', value: 3 })
    expect(relativeAge(5 * HOUR)).toEqual({ unit: 'hour', value: 5 })
    expect(relativeAge(2 * DAY)).toEqual({ unit: 'day', value: 2 })
  })

  it('rejects nonsense', () => {
    expect(relativeAge(-1)).toBeNull()
    expect(relativeAge(NaN)).toBeNull()
  })
})
