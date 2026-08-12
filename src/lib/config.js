// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Which Open Data Hub deployment this build talks to.
 *
 * Resolved at build time from the ENVIRONMENT / MATOMO variables the CI sets,
 * deliberately not at runtime: the published webcomponent must not be
 * redirectable at the test API by an attribute or a query string.
 *
 * The `typeof` guards let the same modules run under plain node (the geo build
 * and the live verification script), where Vite has not substituted anything.
 */

function buildTimeValue(injected, envVar, fallback) {
  if (injected !== undefined) return injected
  if (typeof process !== 'undefined' && process.env) {
    return process.env[envVar] ?? fallback
  }
  return fallback
}

export const ENVIRONMENT = buildTimeValue(
  typeof __ENVIRONMENT__ !== 'undefined' ? __ENVIRONMENT__ : undefined,
  'ENVIRONMENT',
  ''
)

export const MATOMO_ENABLED = buildTimeValue(
  typeof __MATOMO__ !== 'undefined' ? __MATOMO__ : undefined,
  'MATOMO',
  false
)

/**
 * True for the standalone site, false for the distributable webcomponent.
 *
 * Only the site owns its page URL, so only the site mirrors filter state into
 * it. Embedded on someone else's page the component must leave the query
 * string alone, and that is not negotiable per-embed — hence a build constant
 * rather than an attribute.
 */
/*
 * Written as a bare conditional on the injected constant rather than through
 * buildTimeValue, so it folds to a literal at build time. That is what lets the
 * bundler drop the URL-mirroring code entirely from a webcomponent build
 * instead of merely shipping it switched off.
 */
export const IS_STANDALONE =
  typeof __STANDALONE__ !== 'undefined' ? __STANDALONE__ === true : false

const IS_TEST = ENVIRONMENT === 'test'

export const MOBILITY_BASE_URL = IS_TEST
  ? 'https://mobility.api.opendatahub.testingmachine.eu'
  : 'https://mobility.api.opendatahub.com'

export const CONTENT_BASE_URL = IS_TEST
  ? 'https://tourism.api.opendatahub.testingmachine.eu'
  : 'https://tourism.api.opendatahub.com'

// Identifies this app to the Open Data Hub APIs; sent as the `origin` query
// parameter on every request so usage can be attributed.
export const API_ORIGIN = 'webcomp-parking-app'
