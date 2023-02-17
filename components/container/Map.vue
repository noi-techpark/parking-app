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
      show-center
      class="map"
      @singleclick="clickedMap"
      @mounted="onMapMounted"
    >
      <vl-view
        :zoom.sync="zoom"
        :center.sync="curCenter"
        :rotation.sync="rotation"
      ></vl-view>

      <vl-layer-tile id="osm">
        <vl-source-osm></vl-source-osm>
      </vl-layer-tile>
      <vl-layer-vector>
        <vl-source-vector :features="features"></vl-source-vector>
        <vl-style-func :factory="this.markerStyleFunc" />
      </vl-layer-vector>
    </vl-map>
  </div>
</template>

<script>
export default {
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
      zoom: 14,
      isMounted: false,
      curCenter: [11.3536166, 46.4981249],
      refreshLoop: 0,
    }
  },

  computed: {
    features() {
      return Object.freeze(this.points)
    },
    rotation() {
      return this.DEFAULT_CONFIG.ROTATION
    },

    // visibleMarkers() {
    //   return this.markers.length > 1
    //     ? this.markers.filter(
    //         (marker) =>
    //           this.calcCrow(
    //             marker.lat,
    //             marker.lng,
    //             this.curCenter[1],
    //             this.curCenter[0]
    //           ) < this.zoomToKmViewArea
    //       )
    //     : this.markers
    // },

    // zoomToKmViewArea() {
    //   const DEGREE_TO_KM = 110.574
    //   const TOLERANCE = 0.3

    //   if (this.zoom >= 20) {
    //     return DEGREE_TO_KM * 0.00025 + TOLERANCE
    //   } else if (this.zoom >= 19) {
    //     return DEGREE_TO_KM * 0.0005 + TOLERANCE
    //   } else if (this.zoom >= 18) {
    //     return DEGREE_TO_KM * 0.001 + TOLERANCE
    //   } else if (this.zoom >= 17) {
    //     return DEGREE_TO_KM * 0.003 + TOLERANCE
    //   } else if (this.zoom >= 16) {
    //     return DEGREE_TO_KM * 0.005 + TOLERANCE
    //   } else if (this.zoom >= 15) {
    //     return DEGREE_TO_KM * 0.011 + TOLERANCE
    //   } else if (this.zoom >= 14) {
    //     return DEGREE_TO_KM * 0.022 + TOLERANCE
    //   } else if (this.zoom >= 13) {
    //     return DEGREE_TO_KM * 0.044 + TOLERANCE
    //   } else if (this.zoom >= 12) {
    //     return DEGREE_TO_KM * 0.176 + TOLERANCE
    //   } else if (this.zoom >= 11) {
    //     return DEGREE_TO_KM * 0.352 + TOLERANCE
    //   } else if (this.zoom >= 10) {
    //     return DEGREE_TO_KM * 0.703 + TOLERANCE
    //   } else if (this.zoom >= 9) {
    //     return DEGREE_TO_KM * 1.406 + TOLERANCE
    //   } else if (this.zoom >= 8) {
    //     return DEGREE_TO_KM * 2.813 + TOLERANCE
    //   } else if (this.zoom >= 7) {
    //     return DEGREE_TO_KM * 5.625 + TOLERANCE
    //   } else if (this.zoom >= 6) {
    //     return DEGREE_TO_KM * 11.25 + TOLERANCE
    //   } else if (this.zoom >= 5) {
    //     return DEGREE_TO_KM * 22.5 + TOLERANCE
    //   } else if (this.zoom >= 4) {
    //     return DEGREE_TO_KM * 45 + TOLERANCE
    //   } else if (this.zoom >= 3) {
    //     return DEGREE_TO_KM * 90 + TOLERANCE
    //   } else if (this.zoom >= 2) {
    //     return DEGREE_TO_KM * 180 + TOLERANCE
    //   } else if (this.zoom >= 1) {
    //     return DEGREE_TO_KM * 360 + TOLERANCE
    //   }
    //   return TOLERANCE
    // },
  },

  watch: {
    zoom(newZoom) {
      this.refreshLoop += 1
      this.zoomUpdate(newZoom)
    },

    center(newCenter) {
      this.refreshLoop += 1
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
    markerStyleFunc() {
      // style function and styles using OpenLayers API
      // https://openlayers.org/en/latest/apidoc/module-ol_style_Style.html
      return (feature) => {
        // console.log(feature.values_.stype)
        const baseStyle = new this.$ol.Style({
          image:
            feature.values_.stype === 'ParkingSensor'
              ? new this.$ol.RegularShape({
                  points: 4,
                  radius: 25 / Math.SQRT2,
                  radius2: 25,
                  angle: 0,
                  scale: [1, 0.5],
                  fill: new this.$ol.Fill({
                    color: feature.values_.color,
                  }),
                })
              : new this.$ol.Circle({
                  radius: 12,
                  fill: new this.$ol.Fill({
                    color: feature.values_.color,
                  }),
                }),
          text: new this.$ol.Text({
            text: feature.values_.text,
            textAlign: 'center',
          }),
        })
        return [baseStyle]
      }
    },
    calcCrow(lat1, lon1, lat2, lon2) {
      const R = 6371
      const dLat = this.toRad(lat2 - lat1)
      const dLon = this.toRad(lon2 - lon1)
      lat1 = this.toRad(lat1)
      lat2 = this.toRad(lat2)

      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) *
          Math.sin(dLon / 2) *
          Math.cos(lat1) *
          Math.cos(lat2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      const d = R * c
      return d
    },

    toRad(Value) {
      return (Value * Math.PI) / 180
    },

    getStartingCenter() {
      const center = this.config?.center
      if (!center) {
        return null
      }

      if (!center?.lat || !center?.lng) {
        return null
      }

      return [center.lng, center.lat]
    },

    getLocationId(lat, lng) {
      return lat + '-' + lng
    },

    clickedMap(mapData) {
      const feature = this.$refs.map.forEachFeatureAtPixel(
        mapData.pixel,
        function (feature) {
          return feature
        }
      )

      if (!feature) {
        console.log('onclick: no feature found')
        return
      }

      feature.then((result) => {
        const item = this.points.find(
          (marker) => this.getLocationId(marker.lat, marker.lng) === result.id_
        )
        console.log('item', item)

        if (item) {
          this.clickedMarker(item)
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
      // vlMap here is an instance of vl-map component
      // here vlMap.$map - ol.Map instance - is ready to use
      vlMap.refresh()
      // vlMap.$map.addControl(new this.$ol.FullScreen())
      // vlMap.$map.getView().fit(vectorSource.getExtent());
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

    zoomUpdate(newZoom) {
      this.$emit('zoomUpdate', newZoom)
    },

    getParkingAvailability(parkingData) {
      if (parkingData.stype === 'OfflineParking') {
        return 'P'
      }

      return String((parkingData.smetadata?.capacity || 1) - parkingData.mvalue)
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
