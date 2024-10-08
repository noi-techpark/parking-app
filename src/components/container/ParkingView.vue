<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="parking-view">
    <h2 class="title">{{ name }}</h2>
    <div class="map-preview">
      <Map
        :points="parkingMarker"
        :center="mapCenter"
        :options="MAP_OPTIONS"
        map-type="roadmap"
        hide-credits
      />
    </div>
    <div class="timestamp">{{ $t('common.lastUpdate') }} {{ timestamp }}</div>
    <div class="parking-details">
      <span
        v-if="
          data.stype === 'ParkingStation' || data.stype === 'OfflineParking'
        "
      >
        <ParkingStationIco
          text="P"
          :color="data.stype === 'OfflineParking' ? 'blue' : undefined"
        />
        <p class="parking-type">
          {{
            data.stype === 'OfflineParking'
              ? $t('common.parking')
              : $t('common.parkingStation')
          }}
        </p>
      </span>
      <span v-if="data.stype === 'ParkingSensor'">
        <StreetParkingIco text="P" />
        <p class="parking-type">{{ $t('common.streetParking') }}</p>
      </span>

      <p class="total-slots-info">
        <span v-if="data.smetadata.capacity">
          {{
            $t('common.totalParkingSlots', {
              number: data.smetadata.capacity,
            })
          }}
        </span>
      </p>

      <div v-if="data.stype === 'OfflineParking'" class="status-info">
        {{ $t('common.notRealTime') }}
      </div>
      <AvailableSlotsBadge
        v-else
        :total="totalCapacity"
        :free="data.mvalue"
      />
    </div>
    <div v-if="data.stype === 'ParkingStation'" class="graph-ct">
      <ParkingAvailabilityGraph :forecast="data.forecast" />
    </div>
    <a
      :href="
        'https://www.google.com/maps?saddr=&daddr=' +
        data.scoordinate.y +
        ',' +
        data.scoordinate.x +
        '&directionsmode=driving'
      "
      target="_blank"
    >
      <Button
        icon="start-navigation"
        :value="$t('common.goToParking')"
        fill-width
        class="navigation-bt"
        @click="startNavigationToParking"
      />
    </a>
  </div>
</template>

<script>
'use strict'
import utils from '~/mixins/utils'

export default {
  mixins: [utils],

  props: {
    data: {
      type: Object,
      required: true,
    },
  },

  data() {
    return {
      MAP_OPTIONS: {
        streetViewControl: true,
        mapTypeControl: false,
        minZoom: 13,
        maxZoom: 15,
      },
    }
  },

  computed: {
    name() {
      return (
        this.data.smetadata?.standard_name ||
        this.data.sname ||
        this.data.smetadata?.group ||
        this.data.smetadata?.municipality ||
        this.$t('common.parking')
      )
    },

    mapCenter() {
      return [this.data.scoordinate.x, this.data.scoordinate.y]
    },

    totalCapacity() {
      return this.data.smetadata?.capacity || 1
    },

    parkingMarker() {
      return [this.getSimpleMapLocationPointDataBlock(this.data.scoordinate)]
    },
    timestamp() {
      if (!this.data.mvalidtime) return ''
      const date = new Date(this.data.mvalidtime)
      return `${date.getHours()}:${String('0' + date.getMinutes()).slice(
        -2
      )}, ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
    },
  },

  methods: {
    startNavigationToParking() {
      this.emit('startNavigationToParking', this.data)
    },
  },
}
</script>

<style lang="postcss" scoped>
.parking-view {
  @apply pt-4;

  & .timestamp {
    @apply text-grey;
  }

  & .title {
    @apply text-xl mb-1 font-medium;
  }

  & .map-preview {
    @apply relative h-32 rounded-lg overflow-hidden;
  }

  & .parking-details {
    @apply flex items-center justify-center h-12 gap-2;

    & span {
      @apply flex gap-2 items-center;
    }

    & .parking-type {
      @apply text-sm text-primary;
    }

    & .total-slots-info {
      @apply flex-grow text-grey text-right;
    }

    & .status-info {
      @apply text-grey;
    }
  }

  & .graph-ct {
    @apply rounded-md mb-5 pt-4 pb-5 pl-1 pr-2;

    background-color: #f7f7f7;
  }
}
</style>
