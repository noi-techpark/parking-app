// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import {
  SUPPORTED,
  DEFAULT_LOCALE,
  toIso1,
  normalizeLocale,
  detectLocale,
} from '@/lib/locale.js'

describe('locale', () => {
  it('accepts every shape a language can arrive in', () => {
    // ISO 639-3 is the public surface, but the URL, the attribute and the
    // browser all speak two letters, and regional tags are the norm.
    expect(normalizeLocale('deu')).toBe('deu')
    expect(normalizeLocale('de')).toBe('deu')
    expect(normalizeLocale('de-AT')).toBe('deu')
    expect(normalizeLocale('DE')).toBe('deu')
    expect(normalizeLocale('it-IT')).toBe('ita')
    expect(normalizeLocale('en-GB')).toBe('eng')
  })

  it('rejects languages it has no translation for', () => {
    // Not "falls back": the caller has to decide, because a forced attribute
    // and an unreadable URL parameter deserve different treatment.
    expect(normalizeLocale('fra')).toBeNull()
    expect(normalizeLocale('')).toBeNull()
    expect(normalizeLocale(undefined)).toBeNull()
  })

  it('picks the first supported browser language', () => {
    expect(detectLocale({ languages: ['fr', 'de-DE', 'en'] })).toBe('deu')
    expect(detectLocale({ language: 'it-IT' })).toBe('ita')
  })

  it('falls back to the default when the browser wants nothing we have', () => {
    expect(detectLocale({ languages: ['fr', 'ja'] })).toBe(DEFAULT_LOCALE)
    expect(detectLocale({})).toBe(DEFAULT_LOCALE)
    expect(detectLocale(undefined)).toBe(DEFAULT_LOCALE)
  })

  it('maps to the two-letter codes the data sources key by', () => {
    expect(SUPPORTED.map(toIso1)).toEqual(['en', 'it', 'de'])
    // Anything unknown still has to produce a usable lookup key.
    expect(toIso1('fra')).toBe('en')
  })

  it('ships a message file for every supported language', async () => {
    for (const locale of SUPPORTED) {
      const messages = await import(`../src/locales/${locale}.json`)
      expect(Object.keys(messages.default).length).toBeGreaterThan(0)
    }
  })
})
