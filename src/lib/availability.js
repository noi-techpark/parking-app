// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * How a parking expresses its availability, and how fresh that expression is.
 *
 * These two axes used to be tangled together and duplicated across the map
 * styling, the list card and the detail badge, each with its own hardcoded
 * staleness threshold (6h, 4h, and a `new Date(0)` sentinel). They now live
 * here once.
 */

/** What kind of availability number a source can produce at all. */
export const AVAILABILITY_KIND = {
  /** An exact count of free spaces (FAMAS, GARDENA, skidata, sensors…). */
  COUNT: 'count',
  /** An occupancy fraction 0..1 but no absolute count (SBB). */
  RATIO: 'ratio',
  /** Only a coarse LOW/MEDIUM/HIGH band. */
  LEVEL: 'level',
  /** No real-time capability at all (tourism POIs, unknown-capacity stations). */
  NONE: 'none',
}

/** Freshness bucket, derived from the kind plus the age of the last reading. */
export const CATEGORY = {
  /** Real-time capable and recently updated. */
  LIVE: 'live',
  /** Real-time capable but the reading has gone stale — shown with an alert. */
  DELAYED: 'delayed',
  /** Never had real-time data; shown as a plain location. */
  STATIC: 'static',
  /** Older than the retention window; not rendered at all. */
  DROPPED: 'dropped',
}

/** Coarse availability band, used for colour and for sorting. */
export const LEVEL = {
  HIGH: 'high',
  MID: 'mid',
  LOW: 'low',
  UNKNOWN: 'unknown',
}

// Carried over from the original design: at least half free reads as plenty,
// under a fifth reads as nearly full.
const MID_THRESHOLD = 0.2
const HIGH_THRESHOLD = 0.5

/** Maps a free-space fraction (0..1) to a band. */
export function levelFromFreeRatio(ratio) {
  if (!Number.isFinite(ratio)) return LEVEL.UNKNOWN
  if (ratio <= 0 || ratio < MID_THRESHOLD) return LEVEL.LOW
  if (ratio < HIGH_THRESHOLD) return LEVEL.MID
  return LEVEL.HIGH
}

/** SBB reports occupancy bands; availability is their inverse. */
const OCCUPANCY_LEVEL_TO_AVAILABILITY = {
  LOW: LEVEL.HIGH,
  MEDIUM: LEVEL.MID,
  HIGH: LEVEL.LOW,
}

/**
 * The single place that turns a parking into a colour band, whichever way it
 * happens to express itself.
 */
export function availabilityLevel(parking) {
  if (!parking) return LEVEL.UNKNOWN

  switch (parking.availabilityKind) {
    case AVAILABILITY_KIND.COUNT: {
      if (!Number.isFinite(parking.free)) return LEVEL.UNKNOWN
      if (!Number.isFinite(parking.capacity) || parking.capacity <= 0) {
        // A count with no trustworthy total: full/not-full is all we can say.
        return parking.free > 0 ? LEVEL.HIGH : LEVEL.LOW
      }
      return levelFromFreeRatio(parking.free / parking.capacity)
    }
    case AVAILABILITY_KIND.RATIO:
      return Number.isFinite(parking.occupancyRatio)
        ? levelFromFreeRatio(1 - parking.occupancyRatio)
        : LEVEL.UNKNOWN
    case AVAILABILITY_KIND.LEVEL:
      return OCCUPANCY_LEVEL_TO_AVAILABILITY[parking.occupancyLevel] ?? LEVEL.UNKNOWN
    default:
      return LEVEL.UNKNOWN
  }
}

/** Free spaces as a 0..1 fraction, whichever way the source expresses it. */
export function freeFraction(parking) {
  if (!parking) return null
  if (
    parking.availabilityKind === AVAILABILITY_KIND.COUNT &&
    Number.isFinite(parking.free) &&
    Number.isFinite(parking.capacity) &&
    parking.capacity > 0
  ) {
    return Math.min(1, Math.max(0, parking.free / parking.capacity))
  }
  if (
    parking.availabilityKind === AVAILABILITY_KIND.RATIO &&
    Number.isFinite(parking.occupancyRatio)
  ) {
    return Math.min(1, Math.max(0, 1 - parking.occupancyRatio))
  }
  return null
}

/**
 * Buckets a parking by freshness.
 *
 * `liveMaxAge` is what "real time" actually means for this deployment, and
 * `staleMaxAge` is the retention window past which a reading is not shown at
 * all. Both are configurable per embed.
 */
export function classify(parking, { now, liveMaxAge, staleMaxAge }) {
  if (!parking || parking.availabilityKind === AVAILABILITY_KIND.NONE) {
    return CATEGORY.STATIC
  }
  if (!parking.lastUpdate) return CATEGORY.STATIC

  const age = now - parking.lastUpdate
  if (age > staleMaxAge) return CATEGORY.DROPPED
  if (age > liveMaxAge) return CATEGORY.DELAYED
  return CATEGORY.LIVE
}

/**
 * Sort order for the list: most free spaces first within each freshness bucket,
 * so live parkings with room float to the top and stale ones sink.
 */
const CATEGORY_RANK = {
  [CATEGORY.LIVE]: 0,
  [CATEGORY.DELAYED]: 1,
  [CATEGORY.STATIC]: 2,
  [CATEGORY.DROPPED]: 3,
}

export function compareParkings(a, b) {
  const rank = CATEGORY_RANK[a.category] - CATEGORY_RANK[b.category]
  if (rank !== 0) return rank

  const fa = freeFraction(a)
  const fb = freeFraction(b)
  if (fa !== null && fb !== null && fa !== fb) return fb - fa
  if (fa !== null && fb === null) return -1
  if (fa === null && fb !== null) return 1

  return (a.name ?? '').localeCompare(b.name ?? '')
}
