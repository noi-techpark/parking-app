<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    :class="{
      'available-slots': true,
      orange: available / total >= 0.2 && available / total < 0.5,
      red: available === 0 || available / total < 0.2,
    }"
  >
    <span v-if="total > 1" class="count">
      {{ available }}
    </span>
    <span class="label">
      {{ label }}
    </span>
  </div>
</template>

<script>
'use strict'
export default {
  props: {
    free: {
      type: Number,
      required: true,
      default: 0,
    },
    total: {
      type: Number,
      required: false,
      default: null,
    },
  },

  computed: {
    available() {
      return this.free
    },

    label() {
      if (this.total > 1) {
        return this.available === 1
          ? this.$t('common.freeSing')
          : this.$t('common.freePlur')
      }

      return this.available === 1
        ? this.$t('common.freeSing')
        : this.$t('common.occupied')
    },
  },
}
</script>

<style lang="postcss">
.available-slots {
  @apply flex gap-1 items-center justify-center px-3 rounded-md bg-green text-white normal-case;

  padding-top: 0.2rem;
  padding-bottom: 0.1rem;

  & .count {
    @apply text-xl text-base;
  }

  & .label {
    @apply text-xl opacity-75;
  }

  &.orange {
    @apply bg-orange-hover;
  }

  &.red {
    @apply bg-red-hover;
  }
}
</style>
