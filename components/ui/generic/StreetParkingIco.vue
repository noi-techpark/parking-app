<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    :class="{
      'street-parking': true,
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
        return ['green', 'orange', 'red'].includes(value)
      },
    },
  },
}
</script>

<style lang="postcss">
.street-parking {
  @apply flex items-center justify-center w-10 h-6 rounded-md bg-primary-hover select-none;

  & .inner {
    @apply flex items-center justify-center w-9 h-5 rounded-md bg-primary text-primary-hover text-xs;
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
