// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

import { useUrlState } from '@/composables/useUrlState.js'

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

function at(search) {
  window.history.replaceState(null, '', `/parking${search}`)
}

describe('useUrlState', () => {
  let municipality
  let origin
  let parking
  let search
  let state

  const mount = () => {
    municipality = ref([])
    origin = ref([])
    parking = ref([])
    search = ref('')
    state = useUrlState(
      {
        municipality: { ref: municipality, type: 'list' },
        origin: { ref: origin, type: 'list' },
        parking: {
          ref: parking,
          type: 'list',
          // Internal ids out, station codes in the URL.
          to: (ids) => ids.map((id) => id.replace(/^station:/, '')),
        },
        search: { ref: search, type: 'string' },
      },
      { debounceMs: 0 }
    )
    return state
  }

  beforeEach(() => at(''))
  afterEach(() => state?.stop())

  it('reads spelled-out parameters and comma-separated lists', () => {
    at('?municipality=osm:r47283,osm:r47519&origin=FAMAS&search=fiera')
    mount()

    expect(municipality.value).toEqual(['osm:r47283', 'osm:r47519'])
    expect(origin.value).toEqual(['FAMAS'])
    expect(search.value).toBe('fiera')
  })

  it('writes a readable URL: literal commas and colons, no escaping', async () => {
    mount()
    municipality.value = ['osm:r47283', 'osm:r47519']
    parking.value = ['station:105', 'station:urn:parking:skidata:abc']
    await flush(10)

    const query = window.location.search
    // The whole point: hand-readable, not %2C and %3A soup.
    expect(query).toContain('municipality=osm:r47283,osm:r47519')
    expect(query).toContain('parking=105,urn:parking:skidata:abc')
    expect(query).not.toContain('%2C')
    expect(query).not.toContain('%3A')
  })

  it('applies the outward mapping so ids never reach the URL', async () => {
    mount()
    parking.value = ['station:113']
    await flush(10)
    expect(window.location.search).toContain('parking=113')
    expect(window.location.search).not.toContain('station:113')
  })

  it('leaves parameters it does not own alone', async () => {
    at('?utm_source=newsletter&page=2')
    mount()
    origin.value = ['SBB']
    await flush(10)

    expect(window.location.search).toContain('utm_source=newsletter')
    expect(window.location.search).toContain('page=2')
    expect(window.location.search).toContain('origin=SBB')
  })

  it('drops a parameter once its filter is cleared', async () => {
    at('?origin=SBB')
    mount()
    origin.value = []
    await flush(10)
    expect(window.location.search).not.toContain('origin')
  })

  it('still encodes what genuinely needs it', async () => {
    mount()
    search.value = 'via dante & co'
    await flush(10)
    expect(window.location.search).toContain('search=via%20dante%20%26%20co')
  })

  it('re-reads on history navigation', async () => {
    mount()
    at('?origin=FAMAS,GARDENA')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flush(10)
    expect(origin.value).toEqual(['FAMAS', 'GARDENA'])
  })

  it('does not write back what it has just read', async () => {
    at('?origin=SBB')
    mount()
    const before = window.location.search
    await flush(30)
    expect(window.location.search).toBe(before)
  })
})
