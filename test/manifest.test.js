// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import AppView from '@/components/AppView.vue'
import { TAG_NAME } from '@/main.js'
import manifest from '../wcs-manifest.json'

/**
 * The webcomponent store builds its configuration UI from wcs-manifest.json,
 * while the element actually reads Vue props. Nothing links the two, so a prop
 * renamed on one side silently becomes an option that does nothing — these
 * assertions are that link.
 */
const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

describe('wcs-manifest.json', () => {
  const options = manifest.configuration.options

  it('declares the tag the element actually registers', () => {
    expect(manifest.configuration.tagName).toBe(TAG_NAME)
  })

  it('points at the file the build emits', () => {
    expect(manifest.dist.basePath).toBe('dist')
    expect(manifest.dist.files).toContain('bolzano-parking-app.min.js')
  })

  it('declares an option for every configurable prop', () => {
    const declared = new Set(options.map((o) => o.key))
    const missing = Object.keys(AppView.props ?? {})
      .map(kebab)
      .filter((name) => !declared.has(name))

    expect(missing, `props with no manifest option: ${missing.join(', ')}`).toEqual([])
  })

  it('declares no option that is not a real prop', () => {
    const props = new Set(Object.keys(AppView.props ?? {}).map(kebab))
    const orphans = options.map((o) => o.key).filter((key) => !props.has(key))

    expect(orphans, `manifest options with no prop: ${orphans.join(', ')}`).toEqual([])
  })

  it('uses a type the store understands, with a default', () => {
    for (const option of options) {
      expect(['text', 'number', 'select'], `${option.key}`).toContain(option.type)
      expect(option.options, `${option.key} has no options block`).toBeTruthy()
      expect(option.options.default, `${option.key} has no default`).toBeDefined()
    }
  })

  it('offers yes/no choices as a select rather than free text', () => {
    // Booleans arrive as strings; a text box invites "yes", "1" or a typo.
    const booleans = options.filter((o) => o.key === 'show-static')
    expect(booleans.length).toBeGreaterThan(0)
    for (const option of booleans) {
      expect(option.type, `${option.key}`).toBe('select')
      expect(option.options.values).toEqual(['true', 'false'])
    }
  })

  it('covers every filter the UI exposes', () => {
    // Requirements 3, 4 and 5 are individually configurable, and the status
    // facet needs a way in too.
    for (const key of [
      'municipalities',
      'parkings',
      'origins',
      'status',
      'filters',
      'search',
    ]) {
      expect(options.some((o) => o.key === key), `missing option: ${key}`).toBe(true)
    }
  })
})
