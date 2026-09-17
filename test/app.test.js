// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// OpenLayers renders to a canvas that jsdom does not implement. The map is
// verified in a real browser; here it is stubbed so the data -> list -> detail
// wiring can be exercised.
/** Records the props the map was last given, so they can be asserted. */
const mapProps = { current: null }
const mapCalls = { fitBounds: 0, fitToParkings: 0, focusOn: [] }

vi.mock('@/components/map/MapCanvas.vue', () => ({
  default: {
    name: 'MapCanvasStub',
    props: ['parkings', 'selectedIds', 'boundaries', 'ariaLabel'],
    setup: (props, { expose }) => {
      expose({
        fitBounds: () => {
          mapCalls.fitBounds++
        },
        fitToParkings: () => {
          mapCalls.fitToParkings++
        },
        focusOn: (lon, lat) => {
          mapCalls.focusOn.push([lon, lat])
        },
        getMap: () => null,
      })
      return () => {
        mapProps.current = {
          parkings: props.parkings,
          boundaries: props.boundaries,
          selectedIds: props.selectedIds,
        }
        return null
      }
    },
  },
}))

const STATION_META = [
  {
    scode: 'S1',
    sname: 'Parcheggio Centro',
    sorigin: 'FAMAS',
    scoordinate: { x: 11.33818, y: 46.49869 },
    'smetadata.capacity': 100,
    'smetadata.municipality': 'Bolzano - Bozen',
    'smetadata.name_de': 'Parkplatz Zentrum',
  },
  {
    scode: 'SBB:04028',
    sname: 'Rosé',
    sorigin: 'SBB',
    scoordinate: { x: 7.062774, y: 46.782787 },
    'smetadata.capacities': [{ total: 20, categoryType: 'STANDARD' }],
  },
]

const nowIso = () => new Date().toISOString().replace('T', ' ').replace('Z', '+0000')

const STATION_VALUES = [
  { scode: 'S1', tname: 'free', mvalue: 12, mperiod: 300, mvalidtime: nowIso() },
  {
    scode: 'SBB:04028',
    tname: 'currentEstimatedOccupancy',
    mvalue: 0.25,
    mperiod: 1800,
    mvalidtime: nowIso(),
  },
]

/** Headline forecast rows, as the bulk forecast request returns them. */
const FORECAST_ROWS = [30, 60, 90, 120].map((minutes, i) => ({
  scode: 'S1',
  tname: `parking-forecast-${minutes}`,
  ttype: 'Forecast',
  mperiod: minutes * 60,
  // predicted *occupied*; capacity 100 -> 40, 35, 30, 25 free
  mvalue: 60 + i * 5,
}))

/**
 * Tourism POIs, empty except where a test needs a parking with no reading at
 * all — the only way to get a `static` one into the fixture.
 */
let poiItems = []

function routeFetch(url) {
  const href = String(url)
  // The bulk forecast request is the one filtering on tname.re.
  if (href.includes('tname.re.')) return { data: FORECAST_ROWS }
  if (href.includes('ParkingStation') && href.includes('smetadata.capacity')) {
    return { data: STATION_META }
  }
  if (href.includes('ParkingStation')) return { data: STATION_VALUES }
  if (href.includes('ParkingSensor')) return { data: [] }
  if (href.includes('ODHActivityPoi')) return { Items: poiItems }
  return { data: [] }
}

const flush = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Waits for a condition rather than a fixed number of ticks: the first mount
 * also decodes the bundled boundary data, which takes noticeably longer than
 * every later one.
 */
async function until(predicate, timeout = 5000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await flush(5)
  }
  return false
}

async function settle() {
  for (let i = 0; i < 12; i++) await flush(0)
}

describe('parking app end to end (map stubbed)', () => {
  let element

  beforeEach(async () => {
    poiItems = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) => ({
        ok: true,
        status: 200,
        json: async () => routeFetch(url),
      }))
    )
    // ResizeObserver drives the responsive layout and jsdom has none.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      }
    )

    const { TAG_NAME } = await import('@/main.js')
    element = document.createElement(TAG_NAME)
    Object.defineProperty(element, 'clientWidth', { value: 1400, configurable: true })
    document.body.appendChild(element)

    // The first mount also decodes the bundled boundary data, so wait for the
    // list to actually appear rather than for a fixed number of ticks.
    await until(() => element.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()
  })

  afterEach(() => {
    element?.remove()
    document.body.innerHTML = ''
    // The URL is shared jsdom state, and it deliberately outranks attributes:
    // left dirty, one test's selection silently seeds the next one.
    window.history.replaceState(null, '', '/')
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    mapCalls.fitBounds = 0
    mapCalls.fitToParkings = 0
    mapCalls.focusOn = []
  })

  const shadow = () => element.shadowRoot
  const cards = () => [...shadow().querySelectorAll('.parking-card')]
  const text = () => shadow().textContent
  const pills = () => [...shadow().querySelectorAll('.filter-pill')]

  /** Filters live behind pills now, so a panel has to be opened first. */
  async function openFacet(match) {
    const pill = pills().find((p) => p.textContent.match(match))
    expect(pill, `no filter pill matching ${match}`).toBeTruthy()
    pill.click()
    await settle()
    return shadow().querySelector('.filter-panel')
  }

  async function tickOption(match) {
    const box = [...shadow().querySelectorAll('.filter-panel .option input')].find(
      (input) => input.closest('.option').textContent.match(match)
    )
    expect(box, `no option matching ${match}`).toBeTruthy()
    box.dispatchEvent(new Event('change', { bubbles: true }))
    await settle()
  }

  it('renders a card for each parking, whatever shape its data has', () => {
    expect(cards()).toHaveLength(STATION_META.length)
    expect(text()).toContain('Parcheggio Centro')
    expect(text()).toContain('Rosé')
  })

  it('shows a count for counted sources and a percentage for ratio sources', () => {
    const labels = cards().map((card) => card.textContent)
    // 12 of 100 free
    expect(labels.some((l) => l.includes('12'))).toBe(true)
    // 25% occupied -> 75% free, never the string "undefined"
    expect(labels.some((l) => l.includes('75'))).toBe(true)
    expect(text()).not.toContain('undefined')
    expect(text()).not.toContain('NaN')
  })

  it('groups parkings into the municipalities that contain them', async () => {
    // Derived from geometry, not from the inconsistent metadata strings.
    expect(text()).toMatch(/Bolzano/)
    // Five filter dimensions, each behind its own pill.
    expect(pills()).toHaveLength(5)

    const panel = await openFacet(/Municipalit/i)
    expect(panel).not.toBeNull()
    expect(panel.textContent).toMatch(/Bolzano/)
  })

  it('states the current selection on the pill itself', async () => {
    const pill = pills().find((p) => p.textContent.match(/Municipalit/i))
    // Closed panels mean the pill is the only place selection is visible.
    expect(pill.querySelector('.value').textContent.trim()).toBe('All')

    await openFacet(/Municipalit/i)
    await tickOption(/Bolzano/)

    expect(pill.querySelector('.value').textContent).toMatch(/Bolzano/)
    expect(pill.classList.contains('filter-pill--active')).toBe(true)
  })

  it('shows and removes active filters as chips', async () => {
    await openFacet(/Municipalit/i)
    await tickOption(/Bolzano/)

    const chip = shadow().querySelector('.active-filters .chip')
    expect(chip).not.toBeNull()
    expect(chip.textContent).toMatch(/Bolzano/)

    chip.click()
    await settle()
    expect(shadow().querySelector('.active-filters .chip')).toBeNull()
    expect(cards()).toHaveLength(STATION_META.length)
  })

  it('builds a custom dashboard from hand-picked parkings', async () => {
    await openFacet(/Specific parkings/i)
    await tickOption(/Ros/)

    // An explicit parking selection overrides the other filters. Assert on the
    // cards, not the whole shadow root — the open panel lists every option.
    const listed = cards().map((c) => c.textContent).join(' ')
    expect(cards()).toHaveLength(1)
    expect(listed).toContain('Rosé')
    expect(listed).not.toContain('Parcheggio Centro')
    expect(mapProps.current.parkings).toHaveLength(1)
  })

  it('opening a detail does not narrow the view to that parking', async () => {
    // Regression: detail focus and the dashboard selection used to share one
    // ref, so clicking a card silently filtered everything else away.
    cards()[0].click()
    await settle()

    expect(shadow().querySelector('.detail')).not.toBeNull()
    expect(mapProps.current.parkings).toHaveLength(STATION_META.length)
  })

  it('draws a forecast sparkline on the list card, with an axis', async () => {
    /*
     * Regression on two counts. The bulk forecast request shipped with an
     * unencoded regex and returned 400, which a catch swallowed, so every card
     * claimed "no forecast". And the sparkline auto-scales, so without the
     * bound labels the curve conveys a shape but no magnitude.
     */
    const card = cards().find((c) => c.textContent.includes('Parcheggio Centro'))
    const sparkline = card.querySelector('.sparkline')
    expect(sparkline, 'no sparkline rendered').not.toBeNull()

    const ticks = [...sparkline.querySelectorAll('.tick')].map((t) => t.textContent)
    // capacity 100, occupied 60..75 -> 40 down to 25 free; ticks are max, min
    expect(ticks).toEqual(['40', '25'])
    expect(sparkline.querySelectorAll('.grid')).toHaveLength(2)
    expect(sparkline.querySelector('.line').getAttribute('d')).toMatch(/^M/)
  })

  it('can drop the sparkline axis where context already gives the scale', async () => {
    const { default: Sparkline } = await import('@/components/parking/Sparkline.vue')
    expect(Sparkline.props.axis.default).toBe(true)
  })

  it('omits the sparkline entirely when a parking has no forecast', () => {
    const card = cards().find((c) => c.textContent.includes('Rosé'))
    expect(card.querySelector('.sparkline')).toBeNull()
    // ...and does not apologise for it in prose either.
    expect(card.textContent).not.toMatch(/No forecast/i)
  })

  it('centres the map on the parking whose card was clicked', async () => {
    const card = cards().find((c) => c.textContent.includes('Parcheggio Centro'))
    card.click()
    await settle()

    expect(mapCalls.focusOn).toEqual([[11.33818, 46.49869]])
  })

  it('does not move the camera when the marker itself was clicked', async () => {
    // It is already on screen; panning under the cursor would be disorienting.
    const stub = mapProps.current
    expect(stub).toBeTruthy()
    mapCalls.focusOn = []

    const parking = stub.parkings.find((p) => p.name === 'Parcheggio Centro')
    element.shadowRoot.host // keep the element referenced
    const map = element._instance.setupState
    map.onSelectParking(parking, { fromMap: true })
    await settle()

    expect(mapCalls.focusOn).toEqual([])
  })

  it('opens the detail view when a card is chosen', async () => {
    cards()[0].click()
    await settle()
    expect(shadow().querySelector('.detail')).not.toBeNull()
    expect(shadow().querySelector('.detail .navigate')).not.toBeNull()
  })

  it('filters the list down to a selected municipality', async () => {
    await openFacet(/Municipalit/i)
    await tickOption(/Bolzano/)

    expect(cards()).toHaveLength(1)
    expect(text()).toContain('Parcheggio Centro')
  })

  it('narrows the list by a free-text search', async () => {
    const search = shadow().querySelector('.parking-search')
    expect(search).not.toBeNull()

    search.value = 'Centro'
    search.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
    await settle()

    expect(cards()).toHaveLength(1)
    expect(text()).toContain('Parcheggio Centro')
  })

  it('hands the map a boundary outline for the selected municipality', async () => {
    // Regression: selectedBoundaries used to read the boundary dataset before
    // the selection and short-circuit on null, so it never registered the
    // selection as a dependency and stayed cached as [] forever — silently.
    expect(mapProps.current.boundaries).toEqual([])

    await openFacet(/Municipalit/i)
    await tickOption(/Bolzano/)

    expect(mapProps.current.boundaries).toHaveLength(1)
    expect(mapProps.current.boundaries[0].geometry.type).toMatch(/Polygon/)
    expect(mapCalls.fitBounds).toBeGreaterThan(0)
  })

  it('reframes the map on every kind of selection change', async () => {
    // Regression: only the municipality array was watched, so picking specific
    // parkings, an origin or a status left the camera where it was.
    await openFacet(/Specific parkings/i)
    await tickOption(/Ros/)
    const afterParking = mapCalls.fitBounds + mapCalls.fitToParkings
    expect(afterParking).toBeGreaterThan(0)

    shadow().querySelector('.filter-panel .panel-close').click()
    await settle()

    await openFacet(/Data sources/i)
    await tickOption(/SBB/)
    expect(mapCalls.fitBounds + mapCalls.fitToParkings).toBeGreaterThan(afterParking)
  })

  it('hides the filter bar entirely when filters are locked', async () => {
    // A preconfigured dashboard has to be lockable: restricting a filter to
    // single-select still leaves the visitor able to change it.
    element.remove()
    const locked = document.createElement('bolzano-parking-app')
    Object.defineProperty(locked, 'clientWidth', { value: 1400, configurable: true })
    locked.setAttribute('filters', 'none')
    document.body.appendChild(locked)
    await until(() => locked.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()

    expect(locked.shadowRoot.querySelectorAll('.filter-pill')).toHaveLength(0)
    // The language switcher is not a filter and survives the lock — an embed
    // that wants it gone pins `language` instead.
    expect(locked.shadowRoot.querySelectorAll('.filter-slot')).toHaveLength(0)
    // The results themselves are still there.
    expect(locked.shadowRoot.querySelectorAll('.parking-card').length).toBeGreaterThan(0)
    locked.remove()
  })

  it('switches every visible language at once', async () => {
    // The point of the switch is that it reaches the data too: the station's
    // own German name has to replace the Italian one alongside the chrome.
    expect(text()).toContain('Parcheggio Centro')

    const gear = shadow().querySelector('.lang-trigger')
    expect(gear).toBeTruthy()
    gear.click()
    await settle()

    const german = [...shadow().querySelectorAll('.lang-option')].find((o) =>
      o.textContent.includes('Deutsch')
    )
    german.click()
    await settle()

    expect(text()).toContain('Parkplatz Zentrum')
    expect(text()).not.toContain('Parcheggio Centro')
    expect(text()).toContain('Gemeinden')
  })

  it('lets an embed pin the language and take the switcher away', async () => {
    element.remove()
    const pinned = document.createElement('bolzano-parking-app')
    Object.defineProperty(pinned, 'clientWidth', { value: 1400, configurable: true })
    pinned.setAttribute('language', 'deu')
    document.body.appendChild(pinned)
    await until(() => pinned.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()

    expect(pinned.shadowRoot.textContent).toContain('Parkplatz Zentrum')
    expect(pinned.shadowRoot.querySelector('.lang-trigger')).toBeNull()
    pinned.remove()
  })

  it('hides an excluded parking and offers it back through the filter', async () => {
    expect(cards().length).toBeGreaterThan(1)

    const shell = [...shadow().querySelectorAll('.parking-card-shell')].find((el) =>
      el.textContent.includes('Parcheggio Centro')
    )
    const menu = shell.querySelector('.card-actions-trigger')
    expect(menu).toBeTruthy()
    menu.click()
    await settle()
    shell.querySelector('.card-menu-item').click()
    await settle()

    // Gone from the results, but still named by the chip and the filter, which
    // is the only way back.
    expect(cards().some((c) => c.textContent.includes('Parcheggio Centro'))).toBe(false)
    expect(text()).toMatch(/Hidden: Parcheggio Centro/)

    const panel = await openFacet(/Excluded/i)
    expect(panel.textContent).toMatch(/Parcheggio Centro/)
  })

  it('keeps a hidden parking hidden even when it is explicitly selected', async () => {
    element.remove()
    const conflicting = document.createElement('bolzano-parking-app')
    Object.defineProperty(conflicting, 'clientWidth', { value: 1400, configurable: true })
    // Exclusion has to win, or the control cannot be trusted.
    conflicting.setAttribute('parkings', 'S1,SBB:04028')
    conflicting.setAttribute('excluded', 'S1')
    document.body.appendChild(conflicting)
    await until(() => conflicting.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()

    const shown = [...conflicting.shadowRoot.querySelectorAll('.parking-card')]
    expect(shown).toHaveLength(1)
    expect(shown[0].textContent).toContain('Rosé')
    conflicting.remove()
  })

  it('offers the same hide action from the detail view', async () => {
    const card = cards().find((c) => c.textContent.includes('Parcheggio Centro'))
    card.click()
    await settle()

    const detail = shadow().querySelector('.detail')
    expect(detail.textContent).toContain('Parcheggio Centro')

    detail.querySelector('.card-actions-trigger').click()
    await settle()
    detail.querySelector('.card-menu-item').click()
    await settle()

    // Hiding what is on screen has to close it, not leave the detail open on a
    // parking that no longer exists anywhere else.
    expect(shadow().querySelector('.detail')).toBeNull()
    expect(cards().some((c) => c.textContent.includes('Parcheggio Centro'))).toBe(false)
  })

  it('withholds the card menu when the exclusion filter is hidden', async () => {
    // Otherwise a visitor could hide a parking with no way to bring it back.
    element.remove()
    const noEscape = document.createElement('bolzano-parking-app')
    Object.defineProperty(noEscape, 'clientWidth', { value: 1400, configurable: true })
    noEscape.setAttribute('filters', 'municipality')
    document.body.appendChild(noEscape)
    await until(() => noEscape.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()

    expect(noEscape.shadowRoot.querySelector('.card-actions-trigger')).toBeNull()
    noEscape.remove()
  })

  it('applies the status filter to the map, not only to the list', async () => {
    // The map draws `visibleParkings`; a status filter the list applied on its
    // own left the markers — and their cluster counts — behind.
    element.remove()
    poiItems = [
      {
        Id: 'POI1',
        Detail: { en: { Title: 'Parcheggio Talvera' } },
        GpsInfo: [{ Longitude: 11.34, Latitude: 46.503 }],
      },
    ]
    const { TAG_NAME } = await import('@/main.js')
    element = document.createElement(TAG_NAME)
    Object.defineProperty(element, 'clientWidth', { value: 1400, configurable: true })
    document.body.appendChild(element)
    await until(() => shadow()?.querySelectorAll('.parking-card').length === 3)
    await settle()

    expect(mapProps.current.parkings).toHaveLength(3)

    await openFacet(/Status/i)
    await tickOption(/Live/)

    expect(cards()).toHaveLength(2)
    expect(mapProps.current.parkings).toHaveLength(2)
    expect(mapProps.current.parkings.map((p) => p.name)).not.toContain('Parcheggio Talvera')
  })

  it('keeps every status option counted while one of them is selected', async () => {
    // Counting the post-filter list would zero every option the user did not
    // pick, leaving no way to see what selecting it would bring back.
    await openFacet(/Status/i)
    await tickOption(/Live/)

    // The panel stays open, so the options can be read straight back.
    const options = [...shadow().querySelectorAll('.filter-panel .option')]
    const count = (match) =>
      options.find((o) => o.textContent.match(match))?.querySelector('.count')?.textContent

    expect(count(/Live/)).toBe('2')
    expect(count(/No live data/)).toBe('0')
  })

  it('exposes only the filters it is told to', async () => {
    element.remove()
    const some = document.createElement('bolzano-parking-app')
    Object.defineProperty(some, 'clientWidth', { value: 1400, configurable: true })
    some.setAttribute('filters', 'municipality,status')
    document.body.appendChild(some)
    await until(() => some.shadowRoot?.querySelectorAll('.parking-card').length)
    await settle()

    const titles = [...some.shadowRoot.querySelectorAll('.filter-pill')].map(
      (p) => p.querySelector('.title').textContent.trim()
    )
    expect(titles).toHaveLength(2)
    expect(titles.join(' ')).toMatch(/Municipalit/i)
    expect(titles.join(' ')).toMatch(/Status/i)
    expect(titles.join(' ')).not.toMatch(/Specific parkings/i)
    some.remove()
  })

  it('stops polling when the element is removed', async () => {
    const before = globalThis.fetch.mock.calls.length
    element.remove()
    await flush(50)
    // Nothing further should be requested once the element is gone.
    expect(globalThis.fetch.mock.calls.length).toBe(before)
  })
})
