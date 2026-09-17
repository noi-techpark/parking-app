// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { LEVEL, CATEGORY } from './availability.js'

/**
 * The map and the charts draw to a canvas, which cannot read CSS. This resolves
 * the design tokens from the host element once so canvas rendering uses exactly
 * the same palette as the DOM — including any `--color-*` an integrator has
 * overridden on the element.
 */

const TOKENS = [
  'color-primary',
  'color-primary-strong',
  'color-avail-high',
  'color-avail-high-strong',
  'color-avail-mid',
  'color-avail-mid-strong',
  'color-avail-low',
  'color-avail-low-strong',
  'color-avail-none',
  'color-avail-none-strong',
  'color-warn-strong',
  'color-danger-strong',
  'color-ink',
  'color-ink-muted',
  'color-surface',
  'color-border',
]

/** Used when no host is available (unit tests, server-side). */
const FALLBACK = {
  'color-primary': '#009cdd',
  'color-primary-strong': '#007cb0',
  'color-avail-high': '#8be277',
  'color-avail-high-strong': '#2d8519',
  'color-avail-mid': '#e2cd77',
  'color-avail-mid-strong': '#89731a',
  'color-avail-low': '#e28377',
  'color-avail-low-strong': '#d63c29',
  'color-avail-none': '#e4e6e9',
  'color-avail-none-strong': '#747474',
  'color-warn-strong': '#8a6100',
  'color-danger-strong': '#b3271a',
  'color-ink': '#1b1f24',
  'color-ink-muted': '#747474',
  'color-surface': '#ffffff',
  'color-border': '#e2e5e9',
}

export function readThemeTokens(element) {
  if (!element || typeof getComputedStyle !== 'function') return { ...FALLBACK }

  const style = getComputedStyle(element)
  const tokens = {}
  for (const name of TOKENS) {
    const value = style.getPropertyValue(`--${name}`).trim()
    tokens[name] = value || FALLBACK[name]
  }
  return tokens
}

/** Fill / text / border for a marker, given its availability band and freshness. */
export function markerColors(tokens, level, category) {
  if (category === CATEGORY.STATIC || level === LEVEL.UNKNOWN) {
    return {
      fill: tokens['color-surface'],
      stroke: tokens['color-avail-none-strong'],
      text: tokens['color-ink-muted'],
    }
  }

  const band = {
    [LEVEL.HIGH]: 'high',
    [LEVEL.MID]: 'mid',
    [LEVEL.LOW]: 'low',
  }[level]

  return {
    // Pastel fill with ink text: the measured-accessible pairing.
    fill: tokens[`color-avail-${band}`],
    stroke: tokens[`color-avail-${band}-strong`],
    text: tokens['color-ink'],
  }
}
