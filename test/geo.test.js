// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeAll } from 'vitest'

import {
  pointInPolygon,
  pointInGeometry,
  geometryBBox,
  geometryCentroid,
  unionBBox,
  haversineKm,
} from '@/lib/geo/polygon.js'
import { resolveWith } from '@/lib/geo/resolver.js'
import {
  loadMunicipalities,
  boundsOf,
  compositeCentroidOf,
  municipalityDisplayName,
} from '@/lib/geo/municipalities.js'

const SQUARE = [
  [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ],
]

const SQUARE_WITH_HOLE = [
  SQUARE[0],
  [
    [4, 4],
    [6, 4],
    [6, 6],
    [4, 6],
    [4, 4],
  ],
]

describe('polygon helpers', () => {
  it('detects containment', () => {
    expect(pointInPolygon(5, 5, SQUARE)).toBe(true)
    expect(pointInPolygon(15, 5, SQUARE)).toBe(false)
    expect(pointInPolygon(-1, 5, SQUARE)).toBe(false)
  })

  it('treats holes as outside', () => {
    expect(pointInPolygon(5, 5, SQUARE_WITH_HOLE)).toBe(false)
    expect(pointInPolygon(2, 2, SQUARE_WITH_HOLE)).toBe(true)
  })

  it('handles MultiPolygon geometry', () => {
    const geometry = {
      type: 'MultiPolygon',
      coordinates: [
        SQUARE,
        [
          [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        ],
      ],
    }
    expect(pointInGeometry(25, 25, geometry)).toBe(true)
    expect(pointInGeometry(15, 15, geometry)).toBe(false)
  })

  it('computes bbox and centroid', () => {
    const geometry = { type: 'Polygon', coordinates: SQUARE }
    expect(geometryBBox(geometry)).toEqual([0, 0, 10, 10])
    const [cx, cy] = geometryCentroid(geometry)
    expect(cx).toBeCloseTo(5, 6)
    expect(cy).toBeCloseTo(5, 6)
  })

  it('unions bounding boxes and ignores gaps', () => {
    expect(unionBBox([[0, 0, 1, 1], null, [5, 5, 6, 6]])).toEqual([0, 0, 6, 6])
    expect(unionBBox([])).toBeNull()
  })

  it('measures distance', () => {
    // Bolzano -> Merano is roughly 25 km as the crow flies.
    const km = haversineKm([11.3548, 46.4983], [11.1592, 46.6713])
    expect(km).toBeGreaterThan(20)
    expect(km).toBeLessThan(30)
  })
})

describe('resolveWith', () => {
  const features = [
    { geometry: { type: 'Polygon', coordinates: SQUARE } },
    {
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [20, 20],
            [30, 20],
            [30, 30],
            [20, 30],
            [20, 20],
          ],
        ],
      },
    },
  ]
  const index = [
    { id: 'a', n: 'Alpha', c: 'IT', b: [0, 0, 10, 10], p: [5, 5] },
    { id: 'b', n: 'Beta', c: 'CH', b: [20, 20, 30, 30], p: [25, 25] },
  ]

  it('resolves a contained point exactly', () => {
    const resolve = resolveWith(features, index)
    expect(resolve(5, 5)).toEqual({
      id: 'a',
      name: 'Alpha',
      country: 'IT',
      approx: false,
    })
  })

  it('falls back to the nearest centroid just outside a boundary', () => {
    // Municipality-sized (~11 km across), so centroid distance is realistic:
    // the fallback measures to the centroid, not to the nearest edge.
    const smallRing = [
      [
        [11.0, 46.0],
        [11.1, 46.0],
        [11.1, 46.1],
        [11.0, 46.1],
        [11.0, 46.0],
      ],
    ]
    const resolve = resolveWith(
      [{ geometry: { type: 'Polygon', coordinates: smallRing } }],
      [{ id: 'a', n: 'Alpha', c: 'IT', b: [11.0, 46.0, 11.1, 46.1], p: [11.05, 46.05] }]
    )

    const hit = resolve(11.101, 46.05)
    expect(hit.id).toBe('a')
    expect(hit.approx).toBe(true)
  })

  it('returns null when nothing is near enough', () => {
    const resolve = resolveWith(features, index, { maxApproxKm: 1 })
    expect(resolve(100, 80)).toBeNull()
  })

  it('rejects non-finite input', () => {
    const resolve = resolveWith(features, index)
    expect(resolve(NaN, 5)).toBeNull()
    expect(resolve(undefined, undefined)).toBeNull()
  })
})

describe('municipalityDisplayName', () => {
  it('prefers the requested locale', () => {
    const entry = {
      n: 'Bolzano - Bozen',
      nm: { it: 'Bolzano', de: 'Bozen' },
    }
    expect(municipalityDisplayName(entry, 'de')).toBe('Bozen')
    expect(municipalityDisplayName(entry, 'it')).toBe('Bolzano')
  })

  it('keeps a short bilingual name as-is when the locale has no variant', () => {
    // The official form is what locals read; do not reduce it needlessly.
    expect(municipalityDisplayName({ n: 'Bolzano - Bozen' }, 'en')).toBe(
      'Bolzano - Bozen'
    )
  })

  it('reduces a long trilingual concatenation to one language', () => {
    const entry = {
      n: 'Santa Cristina Gherdëina - St. Christina in Gröden - Santa Cristina Valgardena',
      nm: {
        it: 'Santa Cristina Valgardena',
        de: 'St. Christina in Gröden',
      },
    }
    expect(municipalityDisplayName(entry, 'en')).toBe('St. Christina in Gröden')
    expect(municipalityDisplayName(entry, 'it')).toBe('Santa Cristina Valgardena')
  })

  it('falls back to the first segment when no variant is recorded', () => {
    const entry = { n: 'Some Very Long Concatenated Name - Second Form Here' }
    expect(municipalityDisplayName(entry, 'en')).toBe(
      'Some Very Long Concatenated Name'
    )
  })

  it('tolerates a missing entry', () => {
    expect(municipalityDisplayName(null, 'en')).toBeNull()
  })
})

describe('bundled municipality dataset', () => {
  let dataset

  beforeAll(async () => {
    dataset = await loadMunicipalities()
  })

  it('loads boundaries and a matching index', () => {
    expect(dataset.index.length).toBeGreaterThan(1000)
    expect(dataset.features.length).toBe(dataset.index.length)
  })

  it('pins parkings that simplification would otherwise displace', () => {
    // Bolzano airport sits within metres of the Laives border. Simplifying the
    // shipped geometry moves that border across it, so the build pins this and
    // seven other borderline points to the unsimplified answer.
    const hit = dataset.resolve(11.329972, 46.463414)
    expect(hit).not.toBeNull()
    expect(hit.approx).toBe(false)
    expect(hit.name).toMatch(/Bolzano|Bozen/)
    expect(hit.name).not.toMatch(/Laives|Leifers/)
  })

  it('places a real Bolzano parking station in Bolzano', () => {
    // P13 – Direzional Park, sorigin FAMAS
    const hit = dataset.resolve(11.33818, 46.49869)
    expect(hit).not.toBeNull()
    expect(hit.approx).toBe(false)
    expect(hit.country).toBe('IT')
    expect(hit.name).toMatch(/Bolzano|Bozen/)
  })

  it('places a real Swiss SBB station in Switzerland', () => {
    // SBB:04028 "Rosé", which today renders as an unlabelled pin
    const hit = dataset.resolve(7.062774, 46.782787)
    expect(hit).not.toBeNull()
    expect(hit.approx).toBe(false)
    expect(hit.country).toBe('CH')
  })

  it('carries per-language names where the region is bilingual', () => {
    const hit = dataset.resolve(11.6753190552, 46.5767041102) // Ortisei
    const entry = dataset.byId.get(hit.id)
    expect(entry.nm?.it ?? entry.n).toMatch(/Ortisei/)
    expect(entry.nm?.de ?? entry.n).toMatch(/Ulrich/)
  })

  it('returns null well outside the bundled area', () => {
    expect(dataset.resolve(13.5, 43.0)).toBeNull() // Adriatic sea
  })

  it('derives bounds and a composite centroid for several municipalities', () => {
    const bolzano = dataset.resolve(11.33818, 46.49869).id
    const merano = dataset.resolve(11.1592, 46.6713).id
    expect(merano).not.toBe(bolzano)

    const bounds = boundsOf(dataset, [bolzano, merano])
    expect(bounds[0]).toBeLessThan(11.2)
    expect(bounds[2]).toBeGreaterThan(11.3)

    const [lon, lat] = compositeCentroidOf(dataset, [bolzano, merano])
    expect(lon).toBeGreaterThan(bounds[0])
    expect(lon).toBeLessThan(bounds[2])
    expect(lat).toBeGreaterThan(bounds[1])
    expect(lat).toBeLessThan(bounds[3])
  })
})
