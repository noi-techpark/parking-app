<template>
  <div
    :class="{
      'parking-station': true,
      green: color === 'green',
      orange: color === 'orange',
      red: color === 'red',
    }"
  >
    <div class="inner">
      {{ text }}
    </div>
  </div>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      default: 'green',
      validator(value) {
        return ['green', 'orange', 'red', 'blue'].includes(value)
      },
    },
  },
}
</script>

<style lang="postcss">
.parking-station {
  @apply flex items-center justify-center w-6 h-6 rounded-full bg-primary-hover select-none;

  & .inner {
    @apply flex items-center justify-center w-5 h-5 rounded-full bg-primary text-xs;

    color: #76c9e2;
  }

  &.green {
    @apply bg-green-hover;

    & .inner {
      @apply bg-green text-dark-green;
    }
  }

  &.orange {
    @apply bg-orange-hover;

    & .inner {
      @apply bg-orange text-dark-orange;
    }
  }

  &.red {
    @apply bg-red-hover;

    & .inner {
      @apply bg-red text-dark-red;
    }
  }
}
</style>
