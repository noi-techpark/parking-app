// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/*
 * Build-time, never runtime: a published webcomponent must not be redirectable
 * at the test API by an attribute or a query string.
 *
 * Each constant reads its injected value directly rather than through a helper,
 * so it folds to a literal and the unused branch is dropped. Routing it through
 * a function left both API hosts in the bundle, which works but makes the
 * artefact impossible to audit. The `typeof` guard is for plain node, where the
 * geo build and verification scripts import these with nothing substituted.
 */

export const ENVIRONMENT =
  typeof __ENVIRONMENT__ !== 'undefined' ? __ENVIRONMENT__ : ''

export const MATOMO_ENABLED =
  typeof __MATOMO__ !== 'undefined' ? __MATOMO__ === true : false

export const IS_STANDALONE =
  typeof __STANDALONE__ !== 'undefined' ? __STANDALONE__ === true : false

export const MOBILITY_BASE_URL =
  ENVIRONMENT === 'test'
    ? 'https://mobility.api.opendatahub.testingmachine.eu'
    : 'https://mobility.api.opendatahub.com'

export const CONTENT_BASE_URL =
  ENVIRONMENT === 'test'
    ? 'https://tourism.api.opendatahub.testingmachine.eu'
    : 'https://tourism.api.opendatahub.com'

// Sent as the `origin` query parameter so Open Data Hub can attribute usage.
export const API_ORIGIN = 'webcomp-parking-app'
