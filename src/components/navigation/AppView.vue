<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <main>
    <div class="map-ct-up">
      <Map
        ref="map"
        :points="mapMarkers"
        :center="mapCenter"
        :options="MAP_OPTIONS"
        map-type="roadmap"
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
        <div class="tabs-ct parking-types">
          <div
            v-for="parkingType in parkingTypes"
            :key="parkingType.id"
            :class="{
              tab: true,
              current: currentParkingType === parkingType.id,
            }"
            @click="setCurrentParkingType(parkingType.id)"
          >
            <icon :name="parkingType.icon" class="icon" />
            {{ parkingType.name }}
          </div>
        </div>
        <div class="tabs-ct locations">
          <div
            v-for="location in locations"
            :key="location.id"
            :class="{
              tab: true,
              current: currentLocation === location.id,
            }"
            @click="setCurrentLocation(location.id)"
          >
            {{ location.name }}
          </div>
        </div>
        <div class="parking-cards">
          <p v-if="!loadedData" class="load-info">
            {{ $t('common.loading') + '...' }}
          </p>

          <ParkingCard
            v-for="parkingCard in visibleParkingCards"
            :key="parkingCard.id"
            :data="parkingCard"
            class="card"
            @click.native="showParkingDetails(parkingCard)"
          />

          <div class="powered-by">
            <a href="https://opendatahub.com" target="_blank">
              <p class="label">{{ $t('common.poweredBy') }}</p>
              <icon name="open-data-hub" class="logo" />
            </a>
          </div>
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
'use strict'
import vueI18n from '@/plugins/vueI18n'
import 'tailwindcss/tailwind.css'
import '@/assets/css/animations.css'
import '@/assets/css/main.css'

import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '@/tailwind.config.js'

const fullTailwindConfig = resolveConfig(tailwindConfig)

export default {
  i18n: vueI18n,

  data() {
    return {
      AUTO_FETCH_TIMEOUT: 60000,
      BAR_EXPANSION_TOGGLE_OFFSET: 150,
      MAP_OPTIONS: {
        streetViewControl: true,
        mapTypeControl: false,
        zoom: 12,
        minZoom: 11,
        maxZoom: 15,
      },

      loadedData: false,
      searchValue: '',
      isSearching: false,
      parkingStations: null,
      onStreetParkings: null,
      offlineParkings: null,
      parkingCards: [],
      offlineParkingCards: [],
      defaultMapData: [],
      zoomedMapData: [],
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
      currentParkingType: 'live',
      expandedLocationsBar: false,
    }
  },

  computed: {
    locations() {
      return [
        this.getTabDataBlock(
          'bolzano',
          this.$t('places.bolzano'),
          {
            lat: 46.4892313,
            lng: 11.3421382,
          },
          'Bolzano - Bozen'
        ),
        this.getTabDataBlock(
          'merano',
          this.$t('places.merano'),
          {
            lat: 46.6756534,
            lng: 11.1579967,
          },
          'Meran - Merano'
        ),
        this.getTabDataBlock(
          'rovereto',
          this.$t('places.rovereto'),
          {
            lat: 45.8832093,
            lng: 11.0305407,
          },
          'Rovereto'
        ),
        this.getTabDataBlock(
          'trento',
          this.$t('places.trento'),
          {
            lat: 46.0505591,
            lng: 11.1205407,
          },
          'Trento'
        ),
        this.getTabDataBlock(
          'bressanone',
          this.$t('places.bressanone'),
          {
            lat: 46.716401,
            lng: 11.657792,
          },
          'Bressanone'
        ),
        this.getTabDataBlock(
          'brunico',
          this.$t('places.brunico'),
          {
            lat: 46.79636,
            lng: 11.93553,
          },
          'Brunico'
        ),
        this.getTabDataBlock(
          'marlengo',
          this.$t('places.marlengo'),
          {
            lat: 46.6767,
            lng: 11.1167,
          },
          'Marling - Marlengo'
        ),
        this.getTabDataBlock(
          'gardena',
          this.$t('places.gardena'),
          {
            lat: 46.57369,
            lng: 11.671219,
          },
          'Gardena'
        )
      ]
    },

    parkingTypes() {
      return [
        this.getTabDataBlock(
          'live',
          this.$t('common.realTimeParkings'),
          null,
          null,
          'connected'
        ),
        this.getTabDataBlock(
          'all',
          this.$t('common.allParkings'),
          null,
          null,
          'disconnected'
        ),
      ]
    },

    visibleParkingCards() {
      // TODO using municipalityId is too strict, not all parking station/sensor use the municipality
      // as defined in the en.json. 
      return this.parkingCards.filter(
        (card) =>
          card.smetadata?.municipality?.toLowerCase() ===
          this.currentLocationData.municipalityId.toLowerCase()
      )
    },

    mapCenter() {
      const centerObj = this.currentLocationData.center

      return [centerObj.lng, centerObj.lat]
    },

    mapMarkers() {
      return this.mapData.map((card) => {
        const style = this.getParkingIconColors(card)
        return {
          stype: card.stype,
          mvalue: card.mvalue,
          smetadata: {
            capacity: card.smetadata?.capacity || 1,
          },
          lat: card.scoordinate?.y,
          lng: card.scoordinate?.x,
          parkingData: card,
          // GeoJSON props
          type: 'Feature',
          id: card.id,
          geometry: {
            type: 'Point',
            coordinates: [card.scoordinate?.x, card.scoordinate?.y],
          },
          properties: {
            text: this.getParkingIconText(card),
            color: style.color,
            borderColor: style.borderColor,
            textColor: style.textColor,
            stype: card.stype,
          },
        }
      })
    },

    mapData() {
      let data = this.defaultMapData

      if (this.currentParkingType === 'all') {
        data = [...data, ...this.offlineParkingCards]
      }
      return data
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

  created() {
    this.fetchData()
  },

  mounted() {
    this.autoFetch(false)
    this.bindDragEvents()
    this.checkRoute()
  },

  methods: {
    async fetchData() {
      let baseTimeseriesUrl = "https://mobility.api.opendatahub.com" 
      let baseContentUrl = "https://tourism.opendatahub.com" 
      if (process.env.ENVIRONMENT === "test") {
        baseTimeseriesUrl = "https://mobility.api.opendatahub.testingmachine.eu"
        baseContentUrl = "https://content.api.opendatahub.testingmachine.eu"
      }
      const parkingStations = await fetch(
        baseTimeseriesUrl + '/v2/flat,node/ParkingStation/*/latest?limit=-1&where=sactive.eq.true&select=sname,scoordinate,scode,smetadata,sdatatypes,stype,mvalidtime&origin=webcomp-parking-app'
      ).catch((error) => {
        this.handleError(error)
      })
      this.parkingStations = await parkingStations.json()

      const onStreetParkings = await fetch(
        baseTimeseriesUrl + '/v2/flat,node/ParkingSensor/*/latest?limit=-1&where=and(sactive.eq.true,tname.eq.occupied)&select=sname,scoordinate,scode,smetadata,sdatatypes,stype,mvalidtime&origin=webcomp-parking-app'
      ).catch((error) => {
        this.handleError(error)
      })
      this.onStreetParkings = await onStreetParkings.json()

      const offlineParkings = await fetch(
        baseContentUrl + '/v1/Poi?pagenumber=1&poitype=64&subtype=2&pagesize=1000&removenullvalues=true&fields=Detail,GpsInfo&origin=webcomp-parking-app'
      ).catch((error) => {
        this.handleError(error)
      })
      this.offlineParkings = await offlineParkings.json()

      this.constructMapData()
      this.constructData()

      this.loadedData = true
    },

    getParkingIconColors(parkingData) {
      let color = fullTailwindConfig.theme.colors.green
      let borderColor = fullTailwindConfig.theme.colors['green-hover']
      let textColor = fullTailwindConfig.theme.colors["light-black"]

      if (parkingData.stype === 'OfflineParking') {
        color = fullTailwindConfig.theme.colors.primary
        borderColor = fullTailwindConfig.theme.colors['primary-hover']
        textColor = "#FFFF"
      }

      const total = parkingData.smetadata?.capacity || 1
      const available = parkingData.mvalue

      if (available / total >= 0.2 && available / total < 0.5) {
        color = fullTailwindConfig.theme.colors.orange
        borderColor = fullTailwindConfig.theme.colors['orange-hover']
        textColor = "#FFFF"
      }

      if (available === 0 || available / total < 0.2) {
        color = fullTailwindConfig.theme.colors.red
        borderColor = fullTailwindConfig.theme.colors['red-hover']
        textColor = "#FFFF"
      }

      return {
        color,
        borderColor,
        textColor,
      }
    },

    getParkingIconText(parkingData) {
      if (parkingData.stype === 'OfflineParking') {
        return 'P'
      }
      return String(parkingData.mvalue)
    },

    constructData() {
      let parkings = []
      let offlineParkings = []

      if (this.parkingStations?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeParkingDataset(this.parkingStations?.data),
        ]
      }

      if (this.onStreetParkings?.data) {
        parkings = [
          ...parkings,
          ...this.normalizeAndGroupOnStreetParkings(
            this.onStreetParkings?.data
          ),
        ]
      }

      if (this.offlineParkings?.Items) {
        offlineParkings = [
          ...offlineParkings,
          ...this.normalizeOfflineParkingDataset(this.offlineParkings?.Items),
        ]
      }

      this.parkingCards = parkings
      this.offlineParkingCards = offlineParkings

      // sort for mvalidtime to have not real time parking information at last

      const realTimeParkingcard = []
      const nonRealTimeParkingcard = []

      function compareDates(inputDate) {
        const nonRealTimeValue = 6
        const inputDateTime = new Date(inputDate)
        const currentDateTime = new Date()
        const timeDifference =
          Math.abs(currentDateTime - inputDateTime) / (1000 * 60 * 60)

        return timeDifference <= nonRealTimeValue
      }
      this.parkingCards.forEach((i) => {
        if (compareDates(i.mvalidtime)) {
          realTimeParkingcard.push(i)
        } else {
          nonRealTimeParkingcard.push(i)
        }
      })

      this.parkingCards = []

      const sorter = (a, b) => {
        return a.mvalue - b.mvalue
      }

      realTimeParkingcard.sort(sorter)
      realTimeParkingcard.reverse()
      this.parkingCards.push(...realTimeParkingcard)

      nonRealTimeParkingcard.sort(sorter)
      nonRealTimeParkingcard.reverse()
      this.parkingCards.push(...nonRealTimeParkingcard)
    },

    constructMapData() {
      let data = []

      if (this.parkingStations?.data) {
        data = [
          ...data,
          ...this.normalizeParkingDataset(this.parkingStations?.data),
        ]
      }

      if (this.onStreetParkings?.data) {
        data = [
          ...data,
          ...this.normalizeParkingDataset(this.onStreetParkings?.data),
        ]
      }

      this.defaultMapData = data
    },

    autoFetch(fetch) {
      if (fetch) {
        this.fetchData()
      }

      setTimeout(() => this.autoFetch(true), this.AUTO_FETCH_TIMEOUT)
    },

    checkRoute() {
      const locationId = this.$route?.query?.location
      if (locationId && this.locations.find((loc) => loc.id === locationId)) {
        this.currentLocation = locationId
      }
    },

    getTabDataBlock(id, name, center, municipalityId, icon) {
      return {
        id,
        name,
        center,
        municipalityId,
        icon,
      }
    },

    setCurrentParkingType(parkingType) {
      this.currentParkingType = parkingType
    },

    setCurrentLocation(locationId) {
      this.currentLocation = locationId
      if (this.$router) {
        this.$router.replace({
          name: this.$router.name,
          query: { location: locationId },
        })
      }
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

    normalizeParkingDataset(dataset) {
      const rawData = {}

      // Group values by m-period
      const baseId = new Date().getTime()
      dataset.forEach((parking) => {
        // Exclude unsupported types of forecasts
        if (
          parking.tname.startsWith('parking-forecast-low') ||
          parking.tname.startsWith('parking-forecast-high') ||
          parking.tname.startsWith('parking-forecast-rmse')
        ) {
          return true
        }

        // Super hotfix to exclude old laurin data which had period 300, now we have period 600.
        // This leads to 2 timesieries for laurin and the application choses the first one (the one discontinued)
        if (parking.scode === "105" && parking.mperiod === 300) {
          return true;
        }

        const parkingId =
          baseId +
          '-' +
          parking.sname +
          '_' +
          parking.scoordinate.x +
          '_' +
          parking.scoordinate.y

        if (!rawData[parkingId]) {
          rawData[parkingId] = { ...parking }
          rawData[parkingId].id = parkingId
          rawData[parkingId].forecast = []
        }

        if(parking.ttype === 'Forecast') {
          rawData[parkingId].forecast.push({
            mperiod: parking.mperiod,
            mvalue:
              rawData[parkingId].smetadata.capacity -
              Math.round(parking.mvalue),
          })
        }
        else if (parking.ttype === 'Instantaneous' && parking.tname === 'free') {
          // save current mvalue as first value in forecasts array
          rawData[parkingId].forecast.push({
            mperiod: parking.mperiod,
            mvalue: Math.round(parking.mvalue),
          })

          // save actual mvalue
          rawData[parkingId].mperiod = parking.mperiod

          if (parking.stype === 'ParkingSensor')
            rawData[parkingId].mvalue = 1 - Math.round(parking.mvalue)
          else rawData[parkingId].mvalue = Math.round(parking.mvalue)
        }

        rawData[parkingId].forecast = rawData[parkingId].forecast.sort(
          (a, b) => a.mperiod - b.mperiod
        )
      })

      return Object.values(rawData)
    },

    normalizeAndGroupOnStreetParkings(dataset) {
      const rawData = {}

      const baseId = new Date().getTime()
      dataset.forEach((parking) => {
        const parkingId = baseId + '-' + parking.smetadata.group

        if (!rawData[parkingId]) {
          rawData[parkingId] = { ...JSON.parse(JSON.stringify(parking)) }
          rawData[parkingId].id = parkingId
          rawData[parkingId].smetadata.capacity = 0
        }

        // we use occupied datatype, so to get free slots: 1 - occupied slots
        rawData[parkingId].mvalue += 1 - Math.round(parking.mvalue)

        rawData[parkingId].smetadata.capacity += 1

        // use latest mvalidtime for parking sensor groups
        if (
          new Date(rawData[parkingId].mvalidtime) < new Date(parking.mvalidtime)
        )
          rawData[parkingId].mvalidtime = parking.mvalidtime
      })

      return Object.values(rawData)
    },

    normalizeOfflineParkingDataset(dataset) {
      const parkings = []

      dataset.forEach((parking) => {
        let translatedName = parking.Detail[this.$i18n.locale]?.Title
        if (!translatedName) {
          translatedName = parking.Detail.en?.Title
        }

        const coordinates = parking.GpsInfo[0]
        if (coordinates) {
          parkings.push({
            id: parking.Id,
            forecast: [],
            mperiod: null,
            mvalue: null,
            stype: 'OfflineParking',
            sname: translatedName,
            smetadata: {
              capacity: null,
            },
            scoordinate: {
              x: coordinates.Longitude,
              y: coordinates.Latitude,
            },
          })
        }
      })

      return parkings
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

      & .tabs-ct {
        @apply sticky top-0 overflow-x-scroll bg-white pt-5 pb-5;

        white-space: nowrap;
        z-index: 1;

        & .tab {
          @apply inline-block mr-2 rounded-lg text-base text-black px-4 pt-2 bg-placeholder leading-none cursor-pointer select-none;

          padding-bottom: 0.4rem;

          & .icon {
            @apply w-3 h-3 fill-current align-top;

            margin-right: 2px;
          }

          &:first-child {
            @apply ml-5;
          }

          &.current {
            @apply bg-primary text-white;
          }
        }

        &.parking-types {
          @apply pb-2;
        }

        &.locations {
          @apply pt-0;
        }
      }

      & .parking-cards {
        @apply mx-5;

        & .load-info {
          @apply text-grey py-3;
        }

        & .card {
          @apply mb-3;

          &:last-child {
            @apply mb-5;
          }
        }

        & .powered-by {
          @apply w-full mt-6 mb-10;

          flex-shrink: 0;

          & .label {
            @apply text-sm text-black mb-1;
          }

          & .logo {
            @apply h-12;
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
      @apply w-auto left-0 right-0 h-full pointer-events-none;

      & .search-bar {
        @apply mx-5 pointer-events-auto;

        & .search-results {
          max-height: initial;
        }
      }

      & .locations-bar {
        @apply absolute bottom-0 w-full pt-0 transition pointer-events-auto;

        max-height: initial;
        height: calc(100vh - 250px);
        transform: translateY(35vh);

        & .grip-ct {
          @apply sticky flex top-0 bg-white;

          z-index: 1;
        }

        & .tabs-ct {
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
