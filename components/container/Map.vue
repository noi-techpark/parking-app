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
      class="map"
      @singleclick="clickedMap"
      @mounted="onMapMounted"
    >
      <vl-view
        :zoom.sync="zoom"
        :center.sync="showCenter"
        :rotation.sync="rotation"
      ></vl-view>

      <vl-layer-tile id="osm">
        <vl-source-osm></vl-source-osm>
      </vl-layer-tile>

      <vl-layer-vector v-for="(location, index) in markers" :key="index">
        <vl-feature :id="getLocationId(location.lat, location.lng)">
          <vl-geom-point
            :coordinates="[location.lng || 0, location.lat || 0]"
          ></vl-geom-point>
          <vl-style-box>
            <vl-overlay
              :id="getLocationId(location.lat, location.lng) + '-overlay'"
              :position="[location.lng, location.lat]"
              :z-index="2"
            >
              <ParkingStationIco
                v-if="location.stype === 'ParkingStation'"
                :text="String(location.mvalue)"
                class="parking-station-ico"
                :color="getParkingIconColor(location)"
                @click.native="clickedMarker(location)"
              />
              <StreetParkingIco
                v-if="location.stype === 'ParkingSensor'"
                :text="String(location.mvalue)"
                class="street-parking-ico"
                :color="getParkingIconColor(location)"
                @click.native="clickedMarker(location)"
              />
            </vl-overlay>
            <vl-style-icon
              v-if="!location.stype"
              src="/image/marker.png"
              :anchor="[0.5, 1]"
              :scale="0.1"
            >
            </vl-style-icon>
          </vl-style-box>
        </vl-feature>
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
    markers: {
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
        ZOOM: 14,
        CENTER: [11.3536166, 46.4981249],
        ROTATION: 0,
      },
      isMounted: false,
    }
  },

  computed: {
    rotation() {
      return this.DEFAULT_CONFIG.ROTATION
    },

    zoom() {
      return this.options.zoom || this.DEFAULT_CONFIG.ZOOM
    },

    showCenter() {
      return this.center || this.DEFAULT_CONFIG.CENTER
    },
  },

  mounted() {
    this.isMounted = true
  },

  methods: {
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
        return
      }

      feature.then((result) => {
        const item = this.markers.find(
          (marker) => this.getLocationId(marker.lat, marker.lng) === result.id_
        )

        if (item) {
          this.clickedMarker(item)
        }
      })
    },

    clickedMarker(item) {
      console.log('CLICKED_MARK', item)
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
      const available = parkingData.mvalue
      const total = parkingData.smetadata?.capacity

      if (available / total >= 0.2 && available / total < 0.5) {
        return 'orange'
      }

      if (available === 0 || available / total < 0.2) {
        return 'red'
      }

      return 'green'
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
