<template>
  <div class="parking-card">
    <div class="map-ct">
      <Map
        :markers="parkingMarker"
        :center="mapCenter"
        :options="MAP_OPTIONS"
        map-type="roadmap"
        class="map"
        hide-controls
        hide-credits
      />
      <span v-if="data.stype === 'ParkingStation'">
        <ParkingStationIco text="P" class="parking-ico" />
      </span>
      <span v-if="data.stype === 'ParkingSensor'">
        <StreetParkingIco text="P" class="parking-ico" />
      </span>
      <AvailableSlotsBadge
        :total="totalCapacity"
        :available="data.mvalue"
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
</template>

<script>
export default {
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
      return this.data.smetadata?.standard_name || this.data.sname
    },

    totalCapacity() {
      return this.data.smetadata?.capacity
    },

    mapCenter() {
      return [this.data.scoordinate?.x || 0, this.data.scoordinate?.y || 0]
    },

    parkingMarker() {
      return [
        {
          lat: this.data.scoordinate?.y || 0,
          lng: this.data.scoordinate?.x || 0,
        },
      ]
    },
  },
}
</script>

<style lang="postcss" scoped>
.parking-card {
  @apply flex gap-3 bg-secondary rounded-lg py-3 px-3 select-none cursor-pointer;

  & .map-ct {
    @apply relative w-24 h-24 rounded-md;

    flex-shrink: 0;

    & .map {
      @apply rounded-md pointer-events-none overflow-hidden;
    }

    & .parking-ico {
      @apply absolute -left-1 -bottom-1;
    }

    & .slots-badge {
      @apply absolute -right-1 -bottom-1;
    }
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
