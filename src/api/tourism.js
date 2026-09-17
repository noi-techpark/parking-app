// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CONTENT_BASE_URL, API_ORIGIN } from '../lib/config.js'

/**
 * Open Data Hub tourism API (content).
 *
 * These are editorial points of interest — a name and a location, never a live
 * reading. They are fetched exactly once and never polled: the content does not
 * change minute to minute, and the endpoint rate-limits anonymous callers to 10
 * requests, which the old 60-second refresh loop was walking straight into.
 *
 * Selection is by tag rather than the legacy `poitype=64&subtype=2` pair, which
 * only worked through a redirect from the deprecated `/v1/Poi` route.
 */

/** "Parking" tag in the Open Data Hub content taxonomy. */
const PARKING_TAG = '264369BEFCC0461C9C585C867DD0CC88'
const PAGE_SIZE = 1000

export async function fetchParkingPois({ signal } = {}) {
  const url =
    `${CONTENT_BASE_URL}/v1/ODHActivityPoi` +
    `?tagfilter=${PARKING_TAG}` +
    `&pagenumber=1&pagesize=${PAGE_SIZE}` +
    `&removenullvalues=true&fields=Id,Detail,GpsInfo` +
    `&origin=${API_ORIGIN}`

  const response = await fetch(url, { signal })
  if (!response.ok) {
    throw new Error(`Tourism API ${response.status}`)
  }
  const payload = await response.json()
  return payload?.Items ?? []
}
