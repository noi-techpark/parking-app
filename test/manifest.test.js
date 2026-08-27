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

  /*
   * The store validates uploads against its own JSON schema
   * (frontend/src/static/schemas/wcs-manifest-schema.json in
   * noi-techpark/opendatahub-webcomponent-store). A rejected manifest fails the
   * publish step, long after the change that caused it, so the per-type rules
   * are asserted here instead.
   */
  const TYPES = ['null', 'bool', 'text', 'textarea', 'number', 'select', 'multiselect', 'object']

  it('uses a type the store understands', () => {
    for (const option of options) {
      expect(TYPES, `${option.key}`).toContain(option.type)
      expect(option.options, `${option.key} has no options block`).toBeTruthy()
      expect(Object.keys(option), `${option.key} has an unknown field`).toEqual(
        expect.arrayContaining(['key', 'type', 'options'])
      )
    }
  })

  it(`shapes each option's block the way its type requires`, () => {
    for (const option of options) {
      const config = option.options
      if (option.type === 'text' || option.type === 'textarea') {
        // The only type whose default the schema marks required.
        expect(typeof config.default, `${option.key} default`).toBe('string')
      } else if (option.type === 'bool') {
        expect(typeof config.default, `${option.key} default`).toBe('boolean')
      } else if (option.type === 'number') {
        expect(typeof config.default, `${option.key} default`).toBe('number')
        expect(config.min, `${option.key} min`).toBeLessThanOrEqual(config.default)
        expect(config.max, `${option.key} max`).toBeGreaterThanOrEqual(config.default)
      } else if (option.type === 'select' || option.type === 'multiselect') {
        expect(Array.isArray(config.values), `${option.key} values`).toBe(true)
        expect(new Set(config.values).size, `${option.key} values are not unique`).toBe(
          config.values.length
        )
        // The schema's validDefault keyword: a default has to be one of them.
        if (config.default !== undefined) {
          expect(config.values, `${option.key} default`).toContain(config.default)
        }
      }
    }
  })

  it('offers fixed-value options as a dropdown rather than free text', () => {
    const byKey = Object.fromEntries(options.map((o) => [o.key, o]))

    // Yes/no arrives as a string, so a text box invites "yes", "1" or a typo.
    expect(byKey['show-static'].type).toBe('bool')
    expect(byKey['card-actions'].type).toBe('bool')

    expect(byKey.status.type).toBe('multiselect')
    expect(byKey.status.options.values).toEqual(['live', 'delayed', 'static'])
    // A multiselect default can only name one value, and the store's own
    // default embed has to show every status.
    expect(byKey.status.options.default).toBeUndefined()

    expect(byKey.language.type).toBe('select')
    expect(byKey.language.options.values).toEqual(['auto', 'eng', 'ita', 'deu'])

    expect(byKey.zoom.type).toBe('number')
  })

  it('shows how to write the values that are hard to guess', () => {
    const byKey = Object.fromEntries(options.map((o) => [o.key, o]))

    // A municipality id is opaque; nobody will guess "osm:r47207" unaided.
    expect(byKey.municipalities.label).toMatch(/osm:r\d+/)
    expect(byKey.center.label).toMatch(/\d+\.\d+,\s*\d+\.\d+/)
    for (const key of ['live-max-age', 'stale-max-age', 'refresh-interval']) {
      expect(byKey[key].label, `${key} label has no example`).toMatch(/"\d+(s|m|h|d|mo)"/)
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
