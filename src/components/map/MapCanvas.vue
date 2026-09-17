<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div ref="container" class="map-canvas" role="application" :aria-label="ariaLabel" />
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

// Aliased: a bare `Map` import shadows the global Map constructor, which this
// file also uses for plain hashes.
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import VectorLayer from 'ol/layer/Vector'
import OSM from 'ol/source/OSM'
import VectorSource from 'ol/source/Vector'
import Cluster from 'ol/source/Cluster'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat, transformExtent } from 'ol/proj'
import { Circle, Fill, RegularShape, Stroke, Style, Text } from 'ol/style'
import { defaults as defaultControls } from 'ol/control'

import { availabilityLevel, CATEGORY, freeFraction, AVAILABILITY_KIND } from '@/lib/availability.js'
import { STACK, fanOffset, stackKey, stackMode } from '@/lib/map-stack.js'
import { markerColors, readThemeTokens } from '@/lib/theme.js'

const props = defineProps({
  parkings: { type: Array, default: () => [] },
  selectedIds: { type: Array, default: () => [] },
  /** Municipality geometries to outline, as GeoJSON features. */
  boundaries: { type: Array, default: () => [] },
  ariaLabel: { type: String, default: 'Parking map' },
})

const emit = defineEmits(['select', 'viewchange'])

const container = ref(null)

let map = null
let markerLayer = null
let markerSource = null
let boundarySource = null
let clusterSource = null
let tokens = null

// Below this the markers are clustered; above it every parking is drawn.
const CLUSTER_MAX_ZOOM = 13
// Labels are noise when the whole country is on screen.
const LABEL_MIN_ZOOM = 11
const CLUSTER_DISTANCE = 44
/*
 * Above CLUSTER_MAX_ZOOM only markers that genuinely overlap stay grouped, so a
 * "stack" always means "these share a position", never "these happen to be near
 * each other at this zoom".
 */
const COINCIDENT_DISTANCE = 8

/** Which stack is currently spiderfied, keyed by its members. */
let spiderfiedKey = null

const clusterKey = (members) => stackKey(members.map((m) => m.getId()))

const geoJson = new GeoJSON({ featureProjection: 'EPSG:3857' })

/**
 * Marker size carries capacity, colour carries availability and the outline
 * carries freshness — three independent facts that used to be squeezed into
 * one flat colour.
 */
function markerRadius(parking) {
  if (parking.category === CATEGORY.STATIC) return 7
  const capacity = Number.isFinite(parking.capacity) ? parking.capacity : 0
  return Math.max(9, Math.min(18, 9 + Math.sqrt(capacity) / 2.6))
}

function markerLabel(parking) {
  switch (parking.availabilityKind) {
    case AVAILABILITY_KIND.COUNT:
      return Number.isFinite(parking.free) ? String(parking.free) : 'P'
    case AVAILABILITY_KIND.RATIO: {
      const free = freeFraction(parking)
      return free === null ? 'P' : `${Math.round(free * 100)}%`
    }
    case AVAILABILITY_KIND.LEVEL:
      return { LOW: '···', MEDIUM: '··', HIGH: '·' }[parking.occupancyLevel] ?? 'P'
    default:
      return 'P'
  }
}

function parkingStyle(parking, zoom, selected, index = 0, total = 1) {
  const level = availabilityLevel(parking)
  const colors = markerColors(tokens, level, parking.category)
  const radius = markerRadius(parking) * (selected ? 1.3 : 1)
  const showLabel = zoom >= LABEL_MIN_ZOOM || selected

  const stroke = new Stroke({
    color: selected ? tokens['color-primary-strong'] : colors.stroke,
    width: selected ? 3 : 2,
    // A dashed outline is how a delayed reading announces itself, without
    // spending a colour that availability already needs.
    lineDash: parking.category === CATEGORY.DELAYED ? [3, 3] : undefined,
  })
  const fill = new Fill({ color: colors.fill })

  /*
   * On-street bays get a flattened marker rather than a disc, as they did in
   * the original app. A row of metered spaces along a street is a different
   * thing from a multi-storey garage and should not look identical to one.
   */
  const image =
    parking.source === 'sensor'
      ? new RegularShape({
          points: 4,
          radius: radius * 1.5,
          radius2: radius * 1.5,
          angle: Math.PI / 4,
          scale: [1, 0.5],
          fill,
          stroke,
          displacement: fanOffset(index, total),
        })
      : new Circle({ radius, fill, stroke, displacement: fanOffset(index, total) })

  const [dx, dy] = fanOffset(index, total)

  return new Style({
    image,
    text: showLabel
      ? new Text({
          text: markerLabel(parking),
          font: `600 ${radius > 12 ? 12 : 10}px system-ui, sans-serif`,
          fill: new Fill({ color: colors.text }),
          offsetX: dx,
          // Text offsets grow downwards, image displacement upwards.
          offsetY: -dy,
        })
      : undefined,
    zIndex: selected ? 1000 : Math.round(radius),
  })
}

function clusterStyle(size) {
  const radius = Math.max(14, Math.min(26, 12 + Math.log2(size) * 3))
  return new Style({
    image: new Circle({
      radius,
      fill: new Fill({ color: tokens['color-primary'] }),
      stroke: new Stroke({ color: tokens['color-surface'], width: 3 }),
    }),
    text: new Text({
      text: String(size),
      font: '600 12px system-ui, sans-serif',
      fill: new Fill({ color: '#ffffff' }),
    }),
  })
}

function styleFor(feature, resolution) {
  const members = feature.get('features')
  if (!members) return null

  const zoom = map.getView().getZoom() ?? 0
  const selected = new Set(props.selectedIds)
  const single = (member, index = 0, total = 1) => {
    const parking = member.get('parking')
    return parkingStyle(parking, zoom, selected.has(parking.id), index, total)
  }

  const mode = stackMode({
    memberCount: members.length,
    zoom,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    spiderfied: clusterKey(members) === spiderfiedKey,
  })

  if (mode === STACK.SINGLE) return [single(members[0])]
  if (mode === STACK.CLUSTER) return clusterStyle(members.length)
  if (mode === STACK.STACK) return stackStyle(members.length)

  /*
   * Overlapping markers keep their true position until asked. Fanning them out
   * permanently draws every one of them somewhere it is not, with nothing on
   * screen admitting it; the spider only distorts while the user is actively
   * disambiguating, and the legs say where the markers really are.
   */
  const centre = feature.getGeometry().getCoordinates()
  const styles = []
  members.forEach((member, index) => {
    const [dx, dy] = fanOffset(index, members.length)
    styles.push(
      new Style({
        geometry: new LineString([
          centre,
          [centre[0] + dx * resolution, centre[1] + dy * resolution],
        ]),
        stroke: new Stroke({ color: tokens['color-ink-muted'], width: 1 }),
        zIndex: 900,
      })
    )
    styles.push(single(member, index, members.length))
  })
  return styles
}

/** A group of markers sharing a position, collapsed to one. */
function stackStyle(size) {
  return new Style({
    image: new Circle({
      radius: 13,
      fill: new Fill({ color: tokens['color-surface'] }),
      stroke: new Stroke({ color: tokens['color-primary-strong'], width: 2 }),
    }),
    text: new Text({
      text: String(size),
      font: '600 12px system-ui, sans-serif',
      fill: new Fill({ color: tokens['color-ink'] }),
    }),
  })
}

const boundaryStyle = () =>
  new Style({
    stroke: new Stroke({ color: tokens['color-primary-strong'], width: 2 }),
    fill: new Fill({ color: 'rgba(0, 156, 221, 0.06)' }),
  })

function syncMarkers() {
  if (!markerSource) return
  const features = props.parkings
    .filter((p) => Number.isFinite(p.coord?.lon) && Number.isFinite(p.coord?.lat))
    .map((parking) => {
      const feature = new Feature({
        geometry: new Point(fromLonLat([parking.coord.lon, parking.coord.lat])),
      })
      feature.setId(parking.id)
      feature.set('parking', parking)
      return feature
    })

  markerSource.clear()
  markerSource.addFeatures(features)
}

function syncBoundaries() {
  if (!boundarySource) return
  boundarySource.clear()
  if (!props.boundaries.length) return
  boundarySource.addFeatures(
    geoJson.readFeatures({ type: 'FeatureCollection', features: props.boundaries })
  )
}

function onClick(event) {
  const hit = map.forEachFeatureAtPixel(event.pixel, (feature) => feature, {
    hitTolerance: 4,
  })

  const collapse = () => {
    if (spiderfiedKey === null) return
    spiderfiedKey = null
    markerLayer.changed()
  }

  if (!hit) {
    collapse()
    return
  }

  const members = hit.get('features')
  if (!members) return

  if (members.length === 1) {
    collapse()
    emit('select', members[0].get('parking'))
    return
  }

  const zoom = map.getView().getZoom() ?? 0
  if (zoom < CLUSTER_MAX_ZOOM) {
    collapse()
    // Zoom into the cluster rather than guessing which member was meant.
    const extent = members
      .map((m) => m.getGeometry().getCoordinates())
      .reduce(
        (acc, [x, y]) => [
          Math.min(acc[0], x),
          Math.min(acc[1], y),
          Math.max(acc[2], x),
          Math.max(acc[3], y),
        ],
        [Infinity, Infinity, -Infinity, -Infinity]
      )
    map.getView().fit(extent, { padding: [60, 60, 60, 60], duration: 350, maxZoom: 17 })
    return
  }

  const key = clusterKey(members)
  if (spiderfiedKey !== key) {
    spiderfiedKey = key
    markerLayer.changed()
    return
  }

  emit('select', pickMember(members, event.pixel).get('parking'))
}

/**
 * Which of a stacked group was actually clicked.
 *
 * The whole group shares one geometry, so the click pixel has to be matched
 * against the fan slots — otherwise every marker in a stack selects the first
 * member, which is what made the two Costabella car parks indistinguishable.
 */
function pickMember(members, pixel) {
  if (members.length === 1) return members[0]

  const base = map.getPixelFromCoordinate(members[0].getGeometry().getCoordinates())
  if (!base) return members[0]

  let best = members[0]
  let bestDistance = Infinity
  members.forEach((member, index) => {
    const [dx, dy] = fanOffset(index, members.length)
    const distance = (pixel[0] - base[0] - dx) ** 2 + (pixel[1] - base[1] + dy) ** 2
    if (distance < bestDistance) {
      bestDistance = distance
      best = member
    }
  })
  return best
}

/**
 * Fits [minLon, minLat, maxLon, maxLat]; the app's one way to move the camera.
 *
 * With `centre` the camera sits on that point but still takes its zoom from the
 * extent, so a composite centroid never leaves part of the selection off the
 * screen the way a fixed zoom would.
 */
function fitBounds(bounds, { padding = [60, 60, 60, 60], maxZoom = 16, centre } = {}) {
  if (!map || !bounds) return
  const extent = transformExtent(bounds, 'EPSG:4326', 'EPSG:3857')
  if (!extent.every(Number.isFinite)) return

  const view = map.getView()
  if (!centre) {
    view.fit(extent, { padding, maxZoom, duration: 400 })
    return
  }

  const [width, height] = map.getSize() ?? [0, 0]
  const inner = [
    Math.max(1, width - padding[1] - padding[3]),
    Math.max(1, height - padding[0] - padding[2]),
  ]
  // Re-centre on the centroid, so the extent has to span twice the greater
  // half-distance for everything to remain visible.
  const centreMerc = fromLonLat(centre)
  const halfWidth = Math.max(
    Math.abs(extent[2] - centreMerc[0]),
    Math.abs(centreMerc[0] - extent[0])
  )
  const halfHeight = Math.max(
    Math.abs(extent[3] - centreMerc[1]),
    Math.abs(centreMerc[1] - extent[1])
  )
  const resolution = Math.max((halfWidth * 2) / inner[0], (halfHeight * 2) / inner[1])

  view.animate({
    center: centreMerc,
    resolution: Math.max(resolution, view.getResolutionForZoom(maxZoom)),
    duration: 400,
  })
}

function fitToParkings(parkings = props.parkings) {
  const points = parkings.filter((p) => Number.isFinite(p.coord?.lon))
  if (!points.length) return
  const bounds = points.reduce(
    (acc, p) => [
      Math.min(acc[0], p.coord.lon),
      Math.min(acc[1], p.coord.lat),
      Math.max(acc[2], p.coord.lon),
      Math.max(acc[3], p.coord.lat),
    ],
    [Infinity, Infinity, -Infinity, -Infinity]
  )
  fitBounds(bounds)
}

onMounted(() => {
  tokens = readThemeTokens(container.value)

  markerSource = new VectorSource()
  boundarySource = new VectorSource()

  map = new OlMap({
    target: container.value,
    controls: defaultControls({ attribution: true, rotate: false }),
    layers: [
      new TileLayer({
        source: new OSM({
          attributions:
            '<a href="https://opendatahub.com" target="_blank" rel="noopener">OpenDataHub.com</a> | ' +
            'Map data and municipality boundaries &copy; ' +
            '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> ' +
            'contributors, under ODbL.',
        }),
      }),
      new VectorLayer({ source: boundarySource, style: boundaryStyle }),
      (markerLayer = new VectorLayer({
        source: (clusterSource = new Cluster({
          distance: CLUSTER_DISTANCE,
          source: markerSource,
        })),
        style: styleFor,
      })),
    ],
    view: new View({
      center: fromLonLat([11.35, 46.5]),
      zoom: 9,
      maxZoom: 19,
    }),
  })

  map.on('singleclick', onClick)
  map.on('moveend', () => {
    const view = map.getView()
    const zoom = view.getZoom() ?? 0
    const distance = zoom >= CLUSTER_MAX_ZOOM ? COINCIDENT_DISTANCE : CLUSTER_DISTANCE
    if (clusterSource.getDistance() !== distance) {
      spiderfiedKey = null
      clusterSource.setDistance(distance)
    }
    emit('viewchange', { zoom, center: view.getCenter() })
  })

  syncMarkers()
  syncBoundaries()
})

onBeforeUnmount(() => {
  // A webcomponent can be removed and re-added; leaving the map attached leaks
  // its listeners and its tile queue.
  map?.setTarget(undefined)
  map?.dispose?.()
  map = null
})

watch(() => props.parkings, syncMarkers)
watch(() => props.boundaries, syncBoundaries)
watch(
  () => props.selectedIds,
  () => map?.render()
)

/** Zoom in far enough that a single marker is not lost among its neighbours. */
const FOCUS_MIN_ZOOM = 15

function focusOn(lon, lat) {
  if (!map || !Number.isFinite(lon) || !Number.isFinite(lat)) return
  const view = map.getView()
  view.animate({
    center: fromLonLat([lon, lat]),
    // Only ever zoom in: yanking the camera out from a close view is jarring.
    zoom: Math.max(view.getZoom() ?? 0, FOCUS_MIN_ZOOM),
    duration: 400,
  })
}

defineExpose({ fitBounds, fitToParkings, focusOn, getMap: () => map })
</script>

<style>
.map-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--color-surface-sunken);
}

.map-canvas .ol-control {
  padding: 0;
  background: var(--color-surface);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgb(0 0 0 / 18%);
}

.map-canvas .ol-control button {
  width: 2rem;
  height: 2rem;
  margin: 0;
  font-weight: 700;
  color: var(--color-ink);
  background: transparent;
  border-radius: 8px;
}

.map-canvas .ol-control button:hover {
  background: var(--color-surface-sunken);
}

.map-canvas .ol-zoom {
  inset: auto 0.625rem 1.875rem auto;
}

.map-canvas .ol-attribution {
  font-size: 0.6875rem;
  background: rgb(255 255 255 / 80%);
}
</style>
