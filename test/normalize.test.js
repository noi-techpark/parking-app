// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from 'vitest'

import {
  buildStationIndex,
  applyStationValues,
  normalizeSensors,
  normalizePois,
  normalizeForecast,
  parseApiDate,
  SENTINEL_CAPACITY,
} from '@/lib/normalize.js'
import { AVAILABILITY_KIND } from '@/lib/availability.js'

/** Metadata row as the API actually returns it. */
const meta = (over = {}) => ({
  scode: 'X',
  sname: 'Station X',
  sorigin: 'FAMAS',
  stype: 'ParkingStation',
  scoordinate: { x: 11.33818, y: 46.49869, srid: 4326 },
  smetadata: { capacity: 100, municipality: 'Bolzano - Bozen' },
  ...over,
})

const value = (over = {}) => ({
  scode: 'X',
  tname: 'free',
  mvalue: 40,
  mperiod: 300,
  mvalidtime: '2026-08-12 07:00:00.000+0000',
  ...over,
})

const normalize = (metaRows, valueRows) =>
  applyStationValues(buildStationIndex(metaRows), valueRows)

describe('parseApiDate', () => {
  it('parses the non-ISO format the API emits', () => {
    const ts = parseApiDate('2026-05-30 03:15:02.000+0000')
    expect(ts).toBe(Date.UTC(2026, 4, 30, 3, 15, 2))
  })

  it('returns null for junk', () => {
    expect(parseApiDate(null)).toBeNull()
    expect(parseApiDate('not a date')).toBeNull()
  })
})

describe('station normalization', () => {
  it('produces a counted availability from free/capacity', () => {
    const [station] = normalize([meta()], [value()])
    expect(station.availabilityKind).toBe(AVAILABILITY_KIND.COUNT)
    expect(station.free).toBe(40)
    expect(station.capacity).toBe(100)
    expect(station.capacityUnknown).toBe(false)
    expect(station.name).toBe('Station X')
    expect(station.coord).toEqual({ lon: 11.33818, lat: 46.49869 })
  })

  it('prefers standard_name over sname', () => {
    const [station] = normalize(
      [meta({ smetadata: { capacity: 10, standard_name: 'Parcheggio Centro' } })],
      [value()]
    )
    expect(station.name).toBe('Parcheggio Centro')
  })

  it('tracks the most recent reading as the last update', () => {
    const [station] = normalize(
      [meta()],
      [
        value({ tname: 'occupied', mvalidtime: '2026-08-12 06:00:00.000+0000' }),
        value({ tname: 'free', mvalidtime: '2026-08-12 07:30:00.000+0000' }),
      ]
    )
    expect(station.lastUpdate).toBe(Date.UTC(2026, 7, 12, 7, 30, 0))
  })

  describe('skidata short-stay preference (issue #24)', () => {
    it('uses free_short_stay for skidata_dynamicdata, whatever the row order', () => {
      const rows = [
        value({ tname: 'free', mvalue: 100 }),
        value({ tname: 'free_short_stay', mvalue: 20 }),
      ]
      const forward = normalize([meta({ sorigin: 'skidata_dynamicdata' })], rows)
      const reversed = normalize(
        [meta({ sorigin: 'skidata_dynamicdata' })],
        [...rows].reverse()
      )
      expect(forward[0].free).toBe(20)
      expect(reversed[0].free).toBe(20)
    })

    it('leaves plain skidata on its `free` value', () => {
      const [station] = normalize(
        [meta({ sorigin: 'skidata' })],
        [
          value({ tname: 'free', mvalue: 100 }),
          value({ tname: 'free_short_stay', mvalue: 20 }),
        ]
      )
      expect(station.free).toBe(100)
    })
  })

  describe('the 9999 capacity sentinel', () => {
    it('marks the station as having no usable availability', () => {
      const [station] = normalize(
        [
          meta({
            sorigin: 'skidata_dynamicdata',
            smetadata: { capacity: SENTINEL_CAPACITY },
          }),
        ],
        [value({ tname: 'free', mvalue: 42 })]
      )
      expect(station.capacitySentinel).toBe(true)
      expect(station.capacity).toBeNull()
      expect(station.availabilityKind).toBe(AVAILABILITY_KIND.NONE)
    })

    it('applies to any origin, not just skidata', () => {
      const [station] = normalize(
        [meta({ sorigin: 'GARDENA', smetadata: { capacity: 12345 } })],
        [value()]
      )
      expect(station.availabilityKind).toBe(AVAILABILITY_KIND.NONE)
    })

    it('does not confuse a missing capacity with the sentinel', () => {
      const [station] = normalize(
        [meta({ smetadata: { municipality: 'Bolzano - Bozen' } })],
        [value({ tname: 'free', mvalue: 7 })]
      )
      expect(station.capacitySentinel).toBe(false)
      expect(station.capacityUnknown).toBe(true)
      // A count with an unknown total is still a useful count.
      expect(station.availabilityKind).toBe(AVAILABILITY_KIND.COUNT)
      expect(station.free).toBe(7)
    })
  })

  describe('SBB stations', () => {
    const sbbMeta = meta({
      scode: 'SBB:04028',
      sname: 'Rosé',
      sorigin: 'SBB',
      smetadata: {
        address: { city: 'Rosé (Avry)' },
        capacities: [
          { total: 19, categoryType: 'STANDARD' },
          { total: 1, categoryType: 'DISABLED_PARKING_SPACE' },
          { total: 0, categoryType: 'RESERVABLE_PARKING_SPACE' },
        ],
      },
    })

    it('sums the additive capacity categories', () => {
      const [station] = normalize(
        [sbbMeta],
        [value({ scode: 'SBB:04028', tname: 'currentEstimatedOccupancy', mvalue: 0.5 })]
      )
      expect(station.capacity).toBe(20)
    })

    it('reads occupancy as a ratio, not a count', () => {
      const [station] = normalize(
        [sbbMeta],
        [
          value({
            scode: 'SBB:04028',
            tname: 'currentEstimatedOccupancy',
            mvalue: 0.924556,
          }),
        ]
      )
      expect(station.availabilityKind).toBe(AVAILABILITY_KIND.RATIO)
      expect(station.occupancyRatio).toBeCloseTo(0.924556, 6)
      expect(station.free).toBeNull()
    })

    it('falls back to the coarse level when no ratio is published', () => {
      const [station] = normalize(
        [sbbMeta],
        [
          value({
            scode: 'SBB:04028',
            tname: 'currentEstimatedOccupancyLevel',
            mvalue: 'HIGH',
          }),
        ]
      )
      expect(station.availabilityKind).toBe(AVAILABILITY_KIND.LEVEL)
      expect(station.occupancyLevel).toBe('HIGH')
    })

    it('uses the address city as the municipality hint', () => {
      const [station] = normalize([sbbMeta], [value({ scode: 'SBB:04028' })])
      expect(station.municipalityHint).toBe('Rosé (Avry)')
    })
  })

  it('ignores the superseded 300s Laurin timeseries', () => {
    const [station] = normalize(
      [meta({ scode: '105' })],
      [
        value({ scode: '105', mperiod: 300, mvalue: 999 }),
        value({ scode: '105', mperiod: 600, mvalue: 55 }),
      ]
    )
    expect(station.free).toBe(55)
  })

  it('reads the flattened metadata keys a nested select returns', () => {
    // What the API actually sends back for `select=...,smetadata.capacity,...`
    const flatRow = {
      scode: 'SBB:04028',
      sname: 'Rosé',
      sorigin: 'SBB',
      scoordinate: { x: 7.062774, y: 46.782787 },
      'smetadata.capacities': [
        { total: 16, categoryType: 'STANDARD' },
        { total: 4, categoryType: 'DISABLED_PARKING_SPACE' },
      ],
      'smetadata.address.city': 'Rosé (Avry)',
      'smetadata.displayName': 'Rosé',
    }
    const [station] = normalize(
      [flatRow],
      [value({ scode: 'SBB:04028', tname: 'currentEstimatedOccupancy', mvalue: 0.25 })]
    )
    expect(station.capacity).toBe(20)
    expect(station.municipalityHint).toBe('Rosé (Avry)')
    expect(station.availabilityKind).toBe(AVAILABILITY_KIND.RATIO)
  })

  it('keeps a station that has metadata but no reading', () => {
    const [station] = normalize([meta()], [])
    expect(station.availabilityKind).toBe(AVAILABILITY_KIND.NONE)
    expect(station.lastUpdate).toBeNull()
  })

  it('ignores readings for unknown stations', () => {
    const stations = normalize([meta({ scode: 'A' })], [value({ scode: 'GHOST' })])
    expect(stations).toHaveLength(1)
    expect(stations[0].scode).toBe('A')
  })
})

describe('on-street sensors', () => {
  const sensor = (over = {}) => ({
    scode: 's1',
    tname: 'occupied',
    mvalue: 1,
    mvalidtime: '2026-08-12 07:00:00.000+0000',
    scoordinate: { x: 11.343347, y: 46.494292 },
    smetadata: { group: 'area viale Druso', municipality: 'Bolzano - Bozen' },
    ...over,
  })

  it('aggregates bays into their street segment', () => {
    const [segment] = normalizeSensors([
      sensor({ scode: 's1', mvalue: 1 }),
      sensor({ scode: 's2', mvalue: 0 }),
      sensor({ scode: 's3', mvalue: 0 }),
    ])
    expect(segment.capacity).toBe(3)
    // occupied bits inverted: 2 of 3 bays are free
    expect(segment.free).toBe(2)
    expect(segment.name).toBe('area viale Druso')
    expect(segment.availabilityKind).toBe(AVAILABILITY_KIND.COUNT)
  })

  it('keeps separate groups apart and skips ungrouped bays', () => {
    const segments = normalizeSensors([
      sensor({ smetadata: { group: 'A' } }),
      sensor({ smetadata: { group: 'B' } }),
      sensor({ smetadata: {} }),
    ])
    expect(segments).toHaveLength(2)
  })
})

describe('tourism POIs', () => {
  const poi = {
    Id: 'smgpoi123',
    Detail: {
      de: { Title: 'Alpin Arena Schnals' },
      en: { Title: 'Alpin Arena Senales' },
      it: { Title: 'Alpin Arena Senales' },
    },
    GpsInfo: [{ Latitude: 46.7575, Longitude: 10.7826 }],
  }

  it('normalizes to a static parking in the requested locale', () => {
    const [parking] = normalizePois([poi], 'de')
    expect(parking.name).toBe('Alpin Arena Schnals')
    expect(parking.availabilityKind).toBe(AVAILABILITY_KIND.NONE)
    expect(parking.coord).toEqual({ lon: 10.7826, lat: 46.7575 })
  })

  it('falls back to English when the locale is missing', () => {
    const [parking] = normalizePois([poi], 'fr')
    expect(parking.name).toBe('Alpin Arena Senales')
  })

  it('skips entries without coordinates', () => {
    expect(normalizePois([{ ...poi, GpsInfo: [] }], 'en')).toHaveLength(0)
  })
})

describe('forecast series', () => {
  const forecastRows = [
    { ttype: 'Forecast', tname: 'parking-forecast-30', mvalue: 89, mperiod: 1800 },
    { ttype: 'Forecast', tname: 'parking-forecast-60', mvalue: 93, mperiod: 3600 },
    { ttype: 'Forecast', tname: 'parking-forecast-low-30', mvalue: 80, mperiod: 1800 },
    { ttype: 'Forecast', tname: 'parking-forecast-high-30', mvalue: 95, mperiod: 1800 },
    { ttype: 'Forecast', tname: 'parking-forecast-rmse-30', mvalue: 4, mperiod: 1800 },
  ]

  it('converts predicted occupancy into free spaces', () => {
    const series = normalizeForecast(forecastRows, { capacity: 370 })
    expect(series.map((p) => [p.minutes, p.free])).toEqual([
      [30, 281],
      [60, 277],
    ])
  })

  it('derives the confidence band, inverting low/high', () => {
    const series = normalizeForecast(forecastRows, { capacity: 370 })
    const first = series[0]
    // low occupancy -> more free spaces
    expect(first.freeHigh).toBe(290)
    expect(first.freeLow).toBe(275)
  })

  it('anchors the series at the current reading', () => {
    const series = normalizeForecast(forecastRows, { capacity: 370, freeNow: 287 })
    expect(series[0]).toEqual({ minutes: 0, free: 287 })
  })

  it('ignores rmse rows and returns nothing without a capacity', () => {
    expect(normalizeForecast(forecastRows, { capacity: null })).toEqual([])
    const series = normalizeForecast(forecastRows, { capacity: 370 })
    expect(series.some((p) => p.free === 366)).toBe(false)
  })
})
