// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Locales are ISO 639-3 on every public surface — the `language` attribute, the
 * URL, the locale files. Every data source keys by two letters (`name_de`,
 * `Detail.de`, OSM `name:de`), so the conversion happens here, once.
 */

export const SUPPORTED = ['eng', 'ita', 'deu']
export const DEFAULT_LOCALE = 'eng'

const TO_ISO1 = { eng: 'en', ita: 'it', deu: 'de' }
const FROM_ISO1 = { en: 'eng', it: 'ita', de: 'deu' }

export const toIso1 = (locale) => TO_ISO1[locale] ?? 'en'

/** Accepts `deu`, `de`, `de-AT`, `DE`; returns null for anything unsupported. */
export function normalizeLocale(value) {
  if (!value) return null
  const text = String(value).trim().toLowerCase()
  if (SUPPORTED.includes(text)) return text
  const base = text.split(/[-_]/)[0]
  return FROM_ISO1[base] ?? (SUPPORTED.includes(base) ? base : null)
}

/** The visitor's preferred language, in their own order of preference. */
export function detectLocale(navigatorLike = globalThis.navigator) {
  const candidates = [
    ...(navigatorLike?.languages ?? []),
    navigatorLike?.language,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const locale = normalizeLocale(candidate)
    if (locale) return locale
  }
  return DEFAULT_LOCALE
}
