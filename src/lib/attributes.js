// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Webcomponent attributes are always strings.
 *
 * The store's configuration options are declared as String props and parsed
 * here rather than typed as Boolean, because `multi-parking="false"` would
 * otherwise arrive as the truthy string `"false"` — the classic custom-element
 * footgun. Everything degrades to the documented default rather than throwing,
 * so one malformed attribute on an embedding page cannot blank the component.
 */

const FALSEY = new Set(['false', '0', 'no', 'off'])
const TRUTHY = new Set(['', 'true', '1', 'yes', 'on'])

export function parseBool(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value == null) return fallback
  const text = String(value).trim().toLowerCase()
  if (FALSEY.has(text)) return false
  if (TRUTHY.has(text)) return true
  return fallback
}

/** `"a, b ,c"` -> `['a','b','c']`; blank -> `[]`. */
export function parseList(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value == null) return []
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function parseNumber(value, fallback = null) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  if (value == null || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** `"11.35,46.5"` -> `[11.35, 46.5]` (lon, lat). */
export function parseLonLat(value) {
  const parts = parseList(value).map(Number)
  if (parts.length !== 2 || !parts.every(Number.isFinite)) return null
  const [lon, lat] = parts
  if (lon < -180 || lon > 180 || lat < -90 || lat > 90) return null
  return [lon, lat]
}
