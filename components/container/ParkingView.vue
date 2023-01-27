<template>
  <div class="parking-view">
    <h2 class="title">{{ data.sname }}</h2>
    <div class="map-preview">
      <Map
        :markers="parkingMarker"
        :center="mapCenter"
        :options="MAP_OPTIONS"
        map-type="roadmap"
        hide-credits
        @clickedMarker="showParkingDetails"
      />
    </div>
    <div class="parking-details">
      <span v-if="data.stype === 'ParkingStation'">
        <ParkingStationIco text="P" />
        <p class="parking-type">{{ $t('common.parkingStation') }}</p>
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

      <AvailableSlotsBadge :total="totalCapacity" :occupied="data.mvalue" />
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
        streetViewControl: true,
        mapTypeControl: false,
        minZoom: 13,
        maxZoom: 15,
      },
    }
  },

  computed: {
    mapCenter() {
      return [this.data.scoordinate.x, this.data.scoordinate.y]
    },

    totalCapacity() {
      return this.data.smetadata?.capacity || 1
    },

    parkingMarker() {
      return [
        {
          lat: this.data.scoordinate.y || 0,
          lng: this.data.scoordinate.x || 0,
        },
      ]
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
  }

  & .graph-ct {
    @apply rounded-md mb-5 pt-4 pb-5 pl-1 pr-2;

    background-color: #f7f7f7;
  }
}
</style>
