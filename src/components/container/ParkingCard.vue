<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="parking-card">
    <div class="column">
      <div class="available-slots-ct">
        <AvailableSlotsCard
          v-if="data.stype !== 'OfflineParking'"
          :total="totalCapacity"
          :free="data.mvalue"
          :timestamp="new Date(data.mvalidtime)"
          class="slots-badge"
        />
      </div>

      <div class="details">
        <h2>{{ name }}</h2>
        <div class="graph-ct">
          <ParkingAvailabilityGraph
            v-if="data.stype === 'ParkingStation'"
            :forecast="data.forecast"
            :limit-dataset="4"
          />
          <p v-else class="park-notice">
            {{ $t('common.noForecastsAvailable') }}
          </p>
        </div>
      </div>
    </div>
    <div class="timestamp">{{ $t('common.lastUpdate') }} {{ timestamp }}</div>
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
        streetViewControl: false,
        mapTypeControl: false,
        minZoom: 13,
        maxZoom: 15,
      },
    }
  },

  computed: {
    name() {
      return this.data.smetadata?.standard_name || this.data.smetadata?.group  || this.data.sname
    },

    timestamp() {
      const date = new Date(this.data.mvalidtime)
      return `${date.getHours()}:${String('0' + date.getMinutes()).slice(
        -2
      )} ${date.getDate()}/${date.getMonth() + 1}/${String(
        date.getFullYear()
      ).slice(-2)}`
    },

    totalCapacity() {
      return this.data.smetadata?.capacity || 1
    },

    mapCenter() {
      return [this.data.scoordinate?.x || 0, this.data.scoordinate?.y || 0]
    },

    parkingMarker() {
      return [this.getSimpleMapLocationPointDataBlock(this.data.scoordinate)]
    },
  },
}
</script>

<style lang="postcss" scoped>
.parking-card {
  @apply relative flex-row gap-3 bg-secondary rounded-lg py-3 px-3 select-none cursor-pointer;

  & .column {
    @apply flex gap-3 mb-2;
  }

  & .timestamp {
    @apply text-grey text-sm;
  }

  & .available-slots-ct {
    @apply relative w-24 h-24 rounded-md;

    flex-shrink: 0;
  }

  & .details {
    @apply flex-grow overflow-hidden;

    & h2 {
      @apply text-base font-medium;
    }

    & .graph-ct {
      @apply w-full;

      & .park-notice {
        @apply text-grey text-sm;
      }
    }
  }
}

@media only screen and (min-width: 980px) {
  .parking-card {
    width: 310px;
  }
}
</style>
