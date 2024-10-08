<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    :class="{
      'map-ct': true,
      'hidden-controls': hideControls,
      'hidden-credits': hideCredits,
    }"
  >
    <vl-map
      v-if="isMounted"
      ref="map"
      :load-tiles-while-animating="true"
      :load-tiles-while-interacting="true"
      data-projection="EPSG:4326"
      feature-projection="EPSG:4326"
      show-center
      class="map"
      @singleclick="clickedMap"
      @mounted="onMapMounted"
    >
      <vl-view
        :zoom.sync="zoom"
        :maxZoom="this.maxZoom"
        :center.sync="curCenter"
        :rotation.sync="rotation"
      ></vl-view>

      <vl-layer-tile id="osm">
        <vl-source-osm attributions="<a href='https://opendatahub.com' target='_blank'>OpenDataHub.com</a> | &copy <a href='https://www.openstreetmap.org/copyright' target='_blank'>OpenStreetMap</a> contributors."></vl-source-osm>
      </vl-layer-tile>
      <vl-layer-vector>
        <vl-source-cluster :distance="40">
          <vl-source-vector :features="features"></vl-source-vector>
          <vl-style-func :function="markerStyleFunc" />
        </vl-source-cluster>
      </vl-layer-vector>
    </vl-map>
  </div>
</template>

<script>
'use strict'
import Vue from 'vue'
import VueLayers from 'vuelayers'
import 'vuelayers/dist/vuelayers.css'
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '@/tailwind.config.js'
import Style from 'ol/style/Style'
import RegularShape from 'ol/style/RegularShape'
import Circle from 'ol/style/Circle'
import Fill from 'ol/style/Fill'
import Stroke from 'ol/style/Stroke'
import Text from 'ol/style/Text'

import utils from '~/mixins/utils'

const fullTailwindConfig = resolveConfig(tailwindConfig)
Vue.use(VueLayers)

export default {
  mixins: [utils],

  props: {
    options: {
      type: Object,
      default: () => {},
    },
    points: {
      type: Array,
      default: () => [],
    },
    center: {
      type: Array,
      default: () => [],
    },
    hideControls: {
      type: Boolean,
      default: false,
    },
    hideCredits: {
      type: Boolean,
      default: false,
    },
  },

  data() {
    return {
      DEFAULT_CONFIG: {
        ROTATION: 0,
      },
      maxZoom: 20,
      zoom: 14,
      isMounted: false,
      curCenter: [11.3536166, 46.4981249],
      curFeatureIndex: 0,
    }
  },

  computed: {
    features() {
      // save coordinates of points to find points that are on the same coordinate
      const pointsByLocation = {}
      this.points.forEach((p) => {
        const key = p.lat + "-" + p.lng
        if(!(key in pointsByLocation)) {
          pointsByLocation[key] = []
        }
        pointsByLocation[key].push(p)
      })

      // then move markers to "edge of a cirlce" instead of having them on the same coordinate
      for (const value of Object.values(pointsByLocation)) {
        if(value.length > 1) {
          const circlePoints = this.generatePointsCircle(value.length, value[0].geometry.coordinates)
          value.forEach((feature, i) => {
            feature.geometry.coordinates[0] = circlePoints[i][0]
            feature.geometry.coordinates[1] = circlePoints[i][1]
          })
        }
      }
      return Object.freeze(this.points)
    },

    rotation() {
      return this.DEFAULT_CONFIG.ROTATION
    },
  },

  watch: {
    zoom(newZoom) {
      this.zoomUpdate(newZoom)
    },

    center(newCenter) {
      this.curCenter = newCenter
    },
  },

  mounted() {
    this.isMounted = true
  },

  created() {
    if (this.options.zoom) {
      this.zoom = this.options.zoom
    }

    if (this.center) {
      this.curCenter = this.center
    }
  },

  methods: {
    markerStyleFunc(feature) {
      // style function and styles using OpenLayers API
      // https://openlayers.org/en/latest/apidoc/module-ol_style_Style.html

      // fix here to use function instead of factory https://github.com/ghettovoice/vuelayers/issues/462#issuecomment-976523858
      this.curFeatureIndex++

      const size = feature.get('features').length

      if (size === 1 || this.zoom >= this.maxZoom) {
        const features = feature.get('features')
        const styles = []
        features.forEach((feature, i) => {
          const baseStyle = new Style({
            image:
              feature.values_?.stype === 'ParkingSensor'
                ? new RegularShape({
                    points: 4,
                    radius: 25 / Math.SQRT2,
                    radius2: 25,
                    angle: 0,
                    scale: [1, 0.5],
                    fill: new Fill({
                      color: feature.values_.color,
                    }),
                    stroke: new Stroke({
                      color: feature.values_.borderColor,
                      width: 2,
                    }),
                  })
                : new Circle({
                    radius: feature.values_?.stype ? 12 : 4,
                    fill: new Fill({
                      color:
                        feature.values_?.color ||
                        fullTailwindConfig.theme.colors['primary-hover'],
                    }),
                    stroke: new Stroke({
                      color:
                        feature.values_?.borderColor ||
                        fullTailwindConfig.theme.colors.primary,
                      width: 2,
                    }),
                  }),
            text: new Text({
              text: feature.values_?.text || '',
              fill: new Fill({
                color:
                  feature.values_?.textColor ||
                  fullTailwindConfig.theme.colors['primary-text'],
              }),
              textAlign: 'center',
            }),
            zIndex: this.curFeatureIndex,
          })
          styles.push(baseStyle)
        })
        return styles
      } else {
        // from https://github.com/ghettovoice/vuelayers-demo/blob/8195bff514de8a99ec16cab5f43118499e428726/src/components/Map.vue#L681
        const cache = {}
        let style = cache[size]
        if (!style) {
          style = new Style({
            image: new Circle({
              radius: 18,
              fill: new Fill({ color: '#3399cc' }),
              stroke: new Stroke({ color: '#fff', width: 3 }),
            }),
            text: new Text({
              text: size.toString(),
              fill: new Fill({ color: '#fff' }),
            }),
            zIndex: this.curFeatureIndex,
          })
          cache[size] = style
        }
        return [style]
      }
    },

    clickedMap(mapData) {
      const feature = this.$refs.map.forEachFeatureAtPixel(
        mapData.pixel,
        function (feature) {
          return feature
        }
      )

      if (!feature) {
        // eslint-disable-next-line no-console
        console.warn('Unknown parking')
        return
      }

      feature.then((result) => {
        if(result) {
          const size = result.get('features').length
          if (size === 1) {
            // single marker clicked => show detail
            result = result.get('features')[0]
            const item = this.points.find(
              (marker) =>
                marker.id === result.id_
            )

            if (item) {
              this.clickedMarker(item)
            }
          }
          // else {
          // to fix center, projection needs somehow to be changed or converted from EPSG:3857 to EPSG:4326
          // https://epsg.io/transform#s_srs=3857&t_srs=4326&x=NaN&y=NaN
          // mapData.map.getView().animate({
          //   zoom: this.zoom + 2,
          //   duration: 600,
          // })
          // }
        }
      })
    },

    clickedMarker(item) {
      this.$emit('clickedMarker', item)
    },

    refresh() {
      this.$refs.map.refresh()
    },

    render() {
      this.$refs.map.render()
    },

    onMapMounted(vlMap) {
      vlMap.refresh()
    },

    getParkingIconColor(parkingData) {
      if (parkingData.stype === 'OfflineParking') {
        return 'blue'
      }

      const total = parkingData.smetadata?.capacity || 1
      const available = total - parkingData.mvalue

      if (available / total >= 0.2 && available / total < 0.5) {
        return 'orange'
      }

      if (available === 0 || available / total < 0.2) {
        return 'red'
      }

      return 'green'
    },
    // used to create "cirlce of markers" on map,
    // if multiple markers are on the exact same location
    // from analytics.opendatahub.com
    generatePointsCircle(count, centerCoords) {
      if(count < 2) {
        return centerCoords
      }
      const points = []
      const separation = 0.00005
      const twoPi = Math.PI * 2
      const startAngle = twoPi / 12
      const circumference = separation * (2 + count)
      const legLength = circumference / twoPi  // radius from circumference
      const angleStep = twoPi / count

      for (let i = 0; i < count; i++) {
        const angle = startAngle + i * angleStep;
        points.push([
          centerCoords[0] + legLength * Math.cos(angle),
          centerCoords[1] + legLength * Math.sin(angle)
        ])
      }
      return points
    },
    zoomUpdate(newZoom) {
      this.$emit('zoomUpdate', newZoom)
    },
  },
}
</script>

<style lang="postcss">
.map-ct {
  @apply w-full h-full bg-placeholder;

  & .map {
    & .parking-station-ico {
      @apply absolute cursor-pointer;

      left: -0.75rem;
      bottom: -0.25rem;
    }

    & .street-parking-ico {
      @apply absolute cursor-pointer;

      left: -1.25rem;
      bottom: -0.25rem;
    }

    & .ol-zoom {
      top: auto !important;
      left: auto !important;
      bottom: 30px;
      right: 10px;
    }

    & .ol-control {
      @apply bg-white rounded-md p-0 shadow-sm;

      & button {
        @apply bg-transparent rounded-md text-black font-bold m-0
        flex items-center justify-center
        w-8 h-8;

        &:hover {
          @apply bg-placeholder;
        }
      }
    }

    & .ol-attribution {
      @apply bg-transparent;
    }
  }

  &.hidden-controls {
    & .ol-control {
      @apply hidden;
    }
  }

  &.hidden-credits {
    & .ol-attribution {
      @apply hidden;
    }
  }
}
</style>
