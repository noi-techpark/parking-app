// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { fetchStationMetadata } from '@/api/mobility.js'

describe('station metadata request', () => {
  let requested

  beforeEach(() => {
    requested = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => {
        requested.push(String(url))
        return { ok: true, status: 200, json: async () => ({ data: [] }) }
      })
    )
  })

  afterEach(() => vi.unstubAllGlobals())

  it('asks for the localised names in both casings', async () => {
    // The response only carries the nested paths the request selects, so
    // reading `smetadata.name_de` in normalize.js is useless unless it is asked
    // for here — which is exactly how every station stayed Italian.
    await fetchStationMetadata()
    const url = decodeURIComponent(requested[0])

    for (const field of ['name_it', 'name_de', 'name_en', 'name_IT', 'name_DE', 'name_EN']) {
      expect(url, `select is missing smetadata.${field}`).toContain(`smetadata.${field}`)
    }
  })

  it('still selects nested paths rather than the whole metadata blob', async () => {
    // Requesting all of smetadata takes this from 846 kB to 6.1 MB.
    await fetchStationMetadata()
    const url = decodeURIComponent(requested[0])
    expect(url).toMatch(/select=[^&]*smetadata\./)
    expect(url).not.toMatch(/select=[^&]*(^|,)smetadata(,|&|$)/)
  })
})
