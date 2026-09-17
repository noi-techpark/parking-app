// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// `mo` is a nominal 30 days: these windows express "how stale is too stale",
// not calendar arithmetic.
const UNITS = {
  ms: 1,
  s: SECOND,
  m: MINUTE,
  h: HOUR,
  d: DAY,
  w: 7 * DAY,
  mo: 30 * DAY,
  y: 365 * DAY,
}

// Longest suffixes first so `mo` is matched before `m`.
const SUFFIXES = Object.keys(UNITS).sort((a, b) => b.length - a.length)

/**
 * Parses a duration such as `30m`, `6mo`, `4h`, `90s` into milliseconds.
 * Webcomponent attributes arrive as strings, so this is the boundary where
 * `stale-max-age="6mo"` becomes a number.
 *
 * Returns `fallback` for anything unparseable rather than throwing, so one bad
 * attribute cannot take the whole component down.
 */
export function parseDuration(value, fallback = null) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return fallback

  const text = value.trim().toLowerCase()
  if (!text) return fallback

  for (const suffix of SUFFIXES) {
    if (!text.endsWith(suffix)) continue
    const amount = Number(text.slice(0, -suffix.length))
    if (!Number.isFinite(amount) || amount < 0) return fallback
    return amount * UNITS[suffix]
  }

  // Bare number: treat as milliseconds.
  const bare = Number(text)
  return Number.isFinite(bare) && bare >= 0 ? bare : fallback
}

/**
 * Coarse "3 min ago" / "2 days ago" phrasing for staleness badges.
 * Returns the unit and amount; the caller formats it through i18n.
 */
export function relativeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return null
  if (ms < MINUTE) return { unit: 'second', value: Math.floor(ms / SECOND) }
  if (ms < HOUR) return { unit: 'minute', value: Math.floor(ms / MINUTE) }
  if (ms < DAY) return { unit: 'hour', value: Math.floor(ms / HOUR) }
  return { unit: 'day', value: Math.floor(ms / DAY) }
}
