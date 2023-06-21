<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="modal" :class="{ visible }">
    <div class="bg"></div>
    <div class="box show-from-bottom" :style="boxStyle">
      <div v-if="closable" class="close clickable" @click="close">
        <Icon name="cross" />
      </div>
      <div class="h-full">
        <h2 class="title">
          <nuxt-link v-if="titleTo" :to="titleTo" class="clickable text">{{
            title
          }}</nuxt-link>
          <span v-else>{{ title }}</span>
        </h2>
        <div class="content">
          <slot></slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
'use strict'
export default {
  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    title: {
      type: String,
      default: '',
    },
    titleTo: {
      type: String,
      default: null,
    },
    width: {
      type: Number,
      default: 0,
    },
    height: {
      type: Number,
      default: 0,
    },
    closable: {
      type: Boolean,
      default: true,
    },
  },

  computed: {
    boxStyle() {
      return (
        (this.height
          ? 'height:' +
            this.height +
            'px;margin-top:-' +
            this.height / 2 +
            'px;'
          : '') +
        (this.width
          ? 'width:' + this.width + 'px;margin-left:-' + this.width / 2 + 'px;'
          : '')
      )
    },
  },

  methods: {
    close() {
      this.$emit('close', false)
    },
  },
}
</script>

<style lang="postcss" scoped>
.modal {
  @apply relative opacity-0 pointer-events-none transition-opacity duration-200 z-30 h-0;

  transition-timing-function: ease;

  & .bg {
    @apply fixed top-0 right-0 bottom-0 left-0;

    background: rgba(255, 255, 255, 0.8);
  }

  & .box {
    @apply fixed bg-white rounded-box overflow-hidden;

    top: 50%;
    left: 50%;
    width: 500px;
    height: 500px;
    margin-top: -250px;
    margin-left: -250px;
    box-shadow: 0 0 150px rgba(0, 0, 0, 0.1);

    &.show-from-bottom {
      @apply duration-500 opacity-0;

      transform: translateY(50px);
      transition-property: transform, opacity;
    }

    & .close {
      @apply absolute transition-opacity cursor-pointer bg-secondary text-center;

      width: 35px;
      height: 35px;
      border-radius: 50%;
      top: 18px;
      right: 18px;
      z-index: 10;

      & svg {
        @apply align-top;

        width: 13px;
        height: 13px;
        margin-top: 11px;
        fill: #444;
      }

      &:hover {
        @apply bg-secondary-hover;
      }
    }

    & .title {
      @apply text-3xl mb-3 pt-5 px-6 truncate font-bold;

      max-width: calc(100% - 80px);
    }

    & .content {
      @apply overflow-y-auto px-6;

      height: calc(100% - 68px);
    }
  }

  &.visible {
    @apply opacity-100 pointer-events-auto;

    & .box {
      &.show-from-bottom {
        @apply opacity-100;

        transform: translateY(0);
      }
    }
  }
}

@media only screen and (max-width: 980px) {
  .modal {
    & .box {
      @apply w-auto mx-0 overflow-y-auto !important;

      right: 15px;
      left: 15px;
    }
  }
}
</style>
