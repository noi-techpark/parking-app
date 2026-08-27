// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import { parseBool, parseList, parseNumber, parseLonLat } from '@/lib/attributes.js'

describe('parseBool', () => {
  it('reads the spellings an embedding page is likely to write', () => {
    expect(parseBool('true')).toBe(true)
    expect(parseBool('1')).toBe(true)
    expect(parseBool('yes')).toBe(true)
    // A bare attribute (`show-static`) arrives as an empty string.
    expect(parseBool('')).toBe(true)
    expect(parseBool('false')).toBe(false)
    expect(parseBool('0')).toBe(false)
    expect(parseBool('no')).toBe(false)
    expect(parseBool('off')).toBe(false)
  })

  it('does not treat the string "false" as truthy', () => {
    // The custom-element footgun this whole module exists to avoid.
    expect(parseBool('false', true)).toBe(false)
  })

  it('falls back for anything unrecognised', () => {
    expect(parseBool('maybe', true)).toBe(true)
    expect(parseBool(null, true)).toBe(true)
    expect(parseBool(undefined, false)).toBe(false)
  })
})

describe('parseList', () => {
  it('splits and trims', () => {
    expect(parseList('a, b ,c')).toEqual(['a', 'b', 'c'])
  })

  it('drops empties and handles blanks', () => {
    expect(parseList('a,,b,')).toEqual(['a', 'b'])
    expect(parseList('')).toEqual([])
    expect(parseList(null)).toEqual([])
  })
})

describe('parseNumber', () => {
  it('parses and rejects', () => {
    expect(parseNumber('14')).toBe(14)
    expect(parseNumber('1.5')).toBe(1.5)
    expect(parseNumber('abc', 9)).toBe(9)
    expect(parseNumber('', 9)).toBe(9)
  })
})

describe('parseLonLat', () => {
  it('parses a lon,lat pair', () => {
    expect(parseLonLat('11.35,46.5')).toEqual([11.35, 46.5])
  })

  it('rejects malformed or out-of-range coordinates', () => {
    expect(parseLonLat('11.35')).toBeNull()
    expect(parseLonLat('200,46.5')).toBeNull()
    expect(parseLonLat('11.35,120')).toBeNull()
    expect(parseLonLat('a,b')).toBeNull()
    expect(parseLonLat('')).toBeNull()
  })
})

describe('multiselect attributes', () => {
  it('accepts a JSON array as well as a comma-separated list', () => {
    // The store's multiselect option type has no documented encoding, and
    // splitting a JSON array on commas yields '["live"' and '"delayed"]'.
    expect(parseList('["live","delayed"]')).toEqual(['live', 'delayed'])
    expect(parseList('[ "live" , "static" ]')).toEqual(['live', 'static'])
    expect(parseList('live,delayed')).toEqual(['live', 'delayed'])
    expect(parseList('[]')).toEqual([])
  })

  it('falls back to comma-splitting when the brackets are not JSON', () => {
    expect(parseList('[live,delayed]')).toEqual(['[live', 'delayed]'])
  })
})
