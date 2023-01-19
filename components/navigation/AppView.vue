<template>
  <main>
    <div class="map-ct-up">
      <Map
        ref="map"
        :markers="mapMarkers"
        :center="mapCenter"
        :options="MAP_OPTIONS"
        map-type="roadmap"
        @zoomUpdate="handleZoomUpdate"
        @clickedMarker="clickedMarker"
      />
    </div>
    <div class="controls">
      <icon name="extended-logo" class="extended-logo" />
      <div class="search-bar">
        <div class="search-ct">
          <div class="logo">
            <Icon name="logo" />
          </div>
          <div class="input-ct">
            <TextInput
              v-model="searchValue"
              type="search"
              aspect="fill"
              :placeholder="$t('common.parkingName')"
              transparent
            />
          </div>
        </div>
        <div :class="{ 'search-results': true, visible: searchValue.length }">
          <p v-if="isSearching" class="notice">
            {{ $t('common.searching') }}...
          </p>
          <div v-else>
            <p v-if="!searchResults.length" class="notice">
              {{ $t('common.noResultsFound') }}
            </p>
            <div v-else class="results-list">
              <ParkingCard
                v-for="parkingCard in searchResults"
                :key="parkingCard.id"
                :data="parkingCard"
                class="res-card"
                @click.native="showParkingDetails(parkingCard)"
              />
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="!searchValue.length"
        ref="locationsBar"
        :class="{ 'locations-bar': true, expanded: expandedLocationsBar }"
      >
        <div ref="locationsGrip" class="grip-ct">
          <div class="grip" />
        </div>
        <div class="locations-ct">
          <div
            v-for="location in locations"
            :key="location.id"
            :class="{
              location: true,
              current: currentLocation === location.id,
            }"
            @click="setCurrentLocation(location.id)"
          >
            {{ location.name }}
          </div>
        </div>
        <div class="parking-cards">
          <ParkingCard
            v-for="parkingCard in visibleParkingCards"
            :key="parkingCard.id"
            :data="parkingCard"
            class="card"
            @click.native="showParkingDetails(parkingCard)"
          />
        </div>
      </div>
      <Modal
        :visible="parkingDetailsModal.isVisible"
        :height="485"
        @close="hideParkingDetails"
      >
        <ParkingView
          v-if="parkingDetailsModal.isVisible"
          :data="parkingDetailsModal.data"
          @startNavigationToParking="startNavigationToParking"
        />
      </Modal>
    </div>
  </main>
</template>

<script>
export default {
  data() {
    return {
      AUTO_FETCH_TIMEOUT: 30000,
      BAR_EXPANSION_TOGGLE_OFFSET: 150,
      MAP_OPTIONS: {
        streetViewControl: true,
        mapTypeControl: false,
        zoom: 12,
        minZoom: 11,
        maxZoom: 15,
      },

      searchValue: '',
      isSearching: false,
      parkingStations: null,
      onStreetParkings: null,
      parkingCards: [],
      mapData: [],
      parkingDetailsModal: {
        data: null,
        isVisible: false,
      },
      dragInfo: {
        active: false,
        currentX: null,
        currentY: null,
        initialX: null,
        initialY: null,
        xOffset: 0,
        yOffset: 0,
      },
      currentLocation: 'bolzano',
      expandedLocationsBar: false,
      groupStreetParkings: true,
    }
  },

  async fetch() {
    this.parkingStations = await this.$axios
      .$get(
        'https://mobility.api.opendatahub.com/v2/flat,node/ParkingStation/*/latest?limit=-1'
      )
      .catch((error) => {
        this.handleError(error)
      })

    this.onStreetParkings = await this.$axios
      .$get(
        'https://mobility.api.opendatahub.com/v2/flat,node/ParkingSensor/*/latest?limit=-1'
      )
      .catch((error) => {
        this.handleError(error)
      })

    this.constructData()
    this.constructMapData()
  },

  computed: {
    locations() {
      return [
        this.getLocationBlock(
          'bolzano',
          this.$t('places.bolzano'),
          {
            lat: 46.4892313,
            lng: 11.3421382,
          },
          'Bolzano - Bozen'
        ),
        this.getLocationBlock(
          'merano',
          this.$t('places.merano'),
          {
            lat: 46.6756534,
            lng: 11.1579967,
          },
          'Meran - Merano'
        ),
        this.getLocationBlock(
          'rovereto',
          this.$t('places.rovereto'),
          {
            lat: 45.8832093,
            lng: 11.0305407,
          },
          'Rovereto'
        ),
        this.getLocationBlock(
          'trento',
          this.$t('places.trento'),
          {
            lat: 46.0505591,
            lng: 11.1205407,
          },
          'Trento'
        ),
      ]
    },

    visibleParkingCards() {
      return this.parkingCards.filter(
        (card) =>
          card.smetadata?.municipality ===
          this.currentLocationData.municipalityId
      )
    },

    mapCenter() {
      const centerObj = this.currentLocationData.center

      return [centerObj.lng, centerObj.lat]
    },

    mapMarkers() {
      return this.mapData.map((card) => ({
        stype: card.stype,
        mvalue: card.mvalue,
        smetadata: {
          capacity: card.smetadata?.capacity,
        },
        lat: card.scoordinate?.y,
        lng: card.scoordinate?.x,
        parkingData: card,
      }))
    },

    currentLocationData() {
      return this.locations.find(
        (location) => location.id === this.currentLocation
      )
    },

    searchResults() {
      if (!this.searchValue) {
        return []
      }

      const cleanSearchVal = this.searchValue.toLowerCase()
      return this.parkingCards.filter((card) =>
        card.sname.toLowerCase().includes(cleanSearchVal)
      )
    },
  },

  mounted() {
    this.autoFetch(false)
    this.bindDragEvents()
    this.checkRoute()
  },

  methods: {
    constructData() {
      let parkings = []

      if (this.parkingStations?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeParkingDataset(this.parkingStations?.data),
        ]
      }

      if (this.onStreetParkings?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeParkingDataset(this.onStreetParkings?.data),
        ]
      }

      this.parkingCards = parkings
    },

    constructMapData() {
      let parkings = []

      if (this.parkingStations?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeParkingDataset(this.parkingStations?.data, true),
        ]
      }

      if (this.onStreetParkings?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeParkingDataset(this.onStreetParkings?.data, true),
        ]
      }

      this.mapData = parkings
    },

    autoFetch(fetch) {
      if (fetch) {
        this.$fetch()
      }

      setTimeout(() => this.autoFetch(true), this.AUTO_FETCH_TIMEOUT)
    },

    checkRoute() {
      const locationId = this.$route.query.loc
      if (locationId && this.locations.find((loc) => loc.id === locationId)) {
        this.currentLocation = locationId
      }
    },

    getLocationBlock(id, name, center, municipalityId) {
      return {
        id,
        name,
        center,
        municipalityId,
      }
    },

    setCurrentLocation(locationId) {
      this.currentLocation = locationId
      this.$router.replace({
        name: this.$router.name,
        query: { loc: locationId },
      })
      this.$refs.map.render()
    },

    clickedMarker(markerData) {
      this.showParkingDetails(markerData.parkingData)
    },

    showParkingDetails(parkingData) {
      this.parkingDetailsModal.data = parkingData
      this.parkingDetailsModal.isVisible = true
    },

    hideParkingDetails() {
      this.parkingDetailsModal.isVisible = false
    },

    startNavigationToParking(parkingData) {
      // TODO: add here redirect
    },

    normalizeParkingDataset(dataset, forMapData) {
      const rawData = {}

      // Group values by m-period
      const baseId = new Date().getTime()
      dataset.forEach((parking) => {
        const doGrouping =
          forMapData &&
          this.groupStreetParkings &&
          parking.stype === 'ParkingSensor' &&
          typeof parking.smetadata.group !== 'undefined'

        let parkingId = null
        if (doGrouping) {
          parkingId = baseId + '-' + parking.smetadata.group
        } else {
          parkingId =
            baseId +
            '-' +
            parking.sname +
            '_' +
            parking.scoordinate.x +
            '_' +
            parking.scoordinate.y
        }

        if (!rawData[parkingId]) {
          rawData[parkingId] = { ...parking }
          rawData[parkingId].id = parkingId
          rawData[parkingId].forecast = []

          if (doGrouping) {
            rawData[parkingId].smetadata.capacity = 0
          }
        }

        if (doGrouping) {
          rawData[parkingId].mperiod = rawData[parkingId].mperiod +=
            parking.mperiod
          rawData[parkingId].mvalue = rawData[parkingId].mvalue += Math.round(
            parking.mvalue
          )

          rawData[parkingId].smetadata.capacity += 1
        } else if (rawData[parkingId].mperiod >= parking.mperiod) {
          rawData[parkingId].mperiod = parking.mperiod
          rawData[parkingId].mvalue = Math.round(parking.mvalue)
        }

        rawData[parkingId].forecast.push({
          mperiod: parking.mperiod,
          mvalue: Math.round(parking.mvalue),
        })

        rawData[parkingId].forecast = rawData[parkingId].forecast.sort(
          (a, b) => a.mperiod - b.mperiod
        )
      })

      return Object.values(rawData)
    },

    bindDragEvents() {
      const locationsGrip = this.$refs.locationsGrip
      locationsGrip.addEventListener(
        'mousedown',
        this.handleResizeGripMouseDown,
        false
      )
      window.addEventListener('mouseup', this.handleResizeGripMouseUp, false)
      window.addEventListener(
        'mousemove',
        this.handleResizeGripMouseMove,
        false
      )

      locationsGrip.addEventListener(
        'touchstart',
        this.handleResizeGripMouseDown,
        false
      )
      window.addEventListener('touchend', this.handleResizeGripMouseUp, false)
      window.addEventListener(
        'touchmove',
        this.handleResizeGripMouseMove,
        false
      )
    },

    handleResizeGripMouseDown(e) {
      if (e.type === 'touchstart') {
        this.dragInfo.initialX = e.touches[0].clientX - this.dragInfo.xOffset
        this.dragInfo.initialY = e.touches[0].clientY - this.dragInfo.yOffset
      } else {
        this.dragInfo.initialX = e.clientX - this.dragInfo.xOffset
        this.dragInfo.initialY = e.clientY - this.dragInfo.yOffset
      }

      this.dragInfo.active = true

      e.preventDefault()
      e.stopPropagation()
    },

    handleResizeGripMouseUp() {
      if (this.dragInfo.active === true) {
        this.dragInfo.initialX = this.dragInfo.currentX
        this.dragInfo.initialY = this.dragInfo.currentY

        this.dragInfo.active = false
        this.resetTransitionsLock()
      }
    },

    handleResizeGripMouseMove(e) {
      if (this.dragInfo.active) {
        e.preventDefault()
        e.stopPropagation()

        let dragX = null
        let dragY = null

        if (e.type === 'touchmove') {
          dragX = e.touches[0].clientX - this.dragInfo.initialX
          dragY = e.touches[0].clientY - this.dragInfo.initialY
        } else {
          dragX = e.clientX - this.dragInfo.initialX
          dragY = e.clientY - this.dragInfo.initialY
        }

        this.dragInfo.currentX = dragX

        if (
          (dragY < 0 && dragY > -(window.innerHeight / 2)) ||
          (dragY > 0 &&
            dragY + this.$refs.locationsBar.offsetHeight < window.innerHeight)
        ) {
          this.dragInfo.currentY = dragY
        }

        this.setDargOffset(this.dragInfo.currentX, this.dragInfo.currentY)
      }
    },

    setDargOffset(currentX, currentY) {
      this.dragInfo.xOffset = currentX
      this.dragInfo.yOffset = currentY

      this.setTranslate(currentX, currentY)
    },

    setTranslate(xPos, yPos) {
      this.$refs.locationsBar.classList.add('no-transitions')
      this.$refs.locationsBar.style.transform =
        'translate3d(0px, calc(' +
        (this.expandedLocationsBar ? 0 : 35) +
        'vh + ' +
        yPos +
        'px), 0)'
    },

    resetTransitionsLock() {
      if (
        !this.expandedLocationsBar &&
        this.dragInfo.currentY < -this.BAR_EXPANSION_TOGGLE_OFFSET
      ) {
        this.expandedLocationsBar = true
      } else if (
        this.expandedLocationsBar &&
        this.dragInfo.currentY > this.BAR_EXPANSION_TOGGLE_OFFSET
      ) {
        this.expandedLocationsBar = false
      }

      this.$refs.locationsBar.classList.remove('no-transitions')
      this.$refs.locationsBar.style.transform = null
      this.dragInfo.currentX = null
      this.dragInfo.currentY = null
      this.dragInfo.initialX = null
      this.dragInfo.initialY = null
      this.dragInfo.xOffset = 0
      this.dragInfo.yOffset = 0
    },

    handleZoomUpdate(newZoom) {
      const oldGroupingPref = this.groupStreetParkings

      if (newZoom > 14) {
        this.groupStreetParkings = false
      } else {
        this.groupStreetParkings = true
      }

      if (oldGroupingPref !== this.groupStreetParkings) {
        this.$nextTick(() => this.constructMapData(true))
      }
    },
  },
}
</script>

<style lang="postcss" scoped>
main {
  @apply w-full h-full overflow-hidden;

  & .map-ct-up {
    @apply w-full h-full;
  }

  & .controls {
    @apply absolute top-0 left-5;

    width: 350px;

    & .extended-logo {
      @apply hidden;
    }

    & .search-bar {
      @apply mt-8;

      & .search-ct {
        @apply flex bg-white mb-3 px-3 py-1;

        border-radius: 3rem;

        & .logo {
          @apply flex items-center justify-center ml-3;

          & svg {
            @apply w-7 h-7;
          }
        }

        & .input-ct {
          @apply flex-grow;
        }
      }

      & .search-results {
        @apply bg-white rounded-2xl opacity-0 pointer-events-none overflow-hidden;

        transition: max-height 0.3s ease, opacity 0.3s ease;
        max-height: 0;

        & .notice {
          @apply text-base text-grey py-3 px-5;
        }

        & .results-list {
          @apply py-3 px-5;
          & .res-card {
            @apply mb-3;

            &:last-child {
              @apply mb-0;
            }
          }
        }

        &.visible {
          @apply opacity-100 pointer-events-auto mb-3;

          max-height: 80vh;
        }
      }
    }

    & .locations-bar {
      @apply bg-white rounded-2xl overflow-y-auto;

      max-height: 400px;

      & .grip-ct {
        @apply items-center justify-center h-12 hidden;

        & .grip {
          @apply w-10 h-2 rounded-full bg-placeholder;
        }
      }

      & .locations-ct {
        @apply sticky top-0 overflow-x-scroll bg-white pt-5 pb-5;

        white-space: nowrap;
        z-index: 1;

        & .location {
          @apply inline-block mr-2 rounded-lg text-base text-black px-3 py-2 bg-placeholder leading-none cursor-pointer;

          &:first-child {
            @apply ml-5;
          }

          &.current {
            @apply bg-primary text-white;
          }
        }
      }

      & .parking-cards {
        @apply mx-5;

        & .card {
          @apply mb-3;

          &:last-child {
            @apply mb-5;
          }
        }
      }

      &.no-transitions {
        @apply transition-none !important;
      }
    }
  }
}

@media only screen and (max-width: 980px) {
  main {
    & .controls {
      @apply w-auto left-0 right-0 h-full;

      & .search-bar {
        @apply mx-5;

        & .search-results {
          max-height: initial;
        }
      }

      & .locations-bar {
        @apply absolute bottom-0 w-full pt-0 transition;

        max-height: initial;
        height: calc(100vh - 250px);
        transform: translateY(35vh);

        & .grip-ct {
          @apply sticky flex top-0 bg-white;

          z-index: 1;
        }

        & .locations-ct {
          top: 48px;
        }

        &.expanded {
          @apply transform-none;
        }
      }
    }
  }
}

@media only screen and (min-width: 980px) {
  main {
    & .map-ct-up {
      @apply w-1/2;

      margin-left: 50%;
    }

    & .controls {
      @apply h-full;

      width: calc(50vw - 3rem);

      & .extended-logo {
        @apply block mx-5 h-10 mt-10;
      }

      & .search-bar {
        @apply mx-5 mt-4;

        & .logo {
          @apply hidden !important;
        }

        & .search-ct {
          @apply bg-input;
        }
      }

      & .locations-bar {
        max-height: calc(100% - 155px);

        & .parking-cards {
          @apply flex flex-wrap gap-x-3;
        }
      }
    }
  }
}
</style>
