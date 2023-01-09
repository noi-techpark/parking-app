<template>
  <div
    class="box"
    :class="{
      disabled,
      responsive,
      'with-action': actionButtonLabel !== null || actionButtonImage !== null,
      'with-label': actionButtonLabel !== null,
      compact: aspect === 'compact',
      'fill-content': containerMode === 'fill',
      'no-padding': noPadding,
      'colored-background': coloredBackground,
    }"
  >
    <div class="content">
      <slot />
    </div>
    <div v-if="actionButtonLabel || actionButtonImage" class="action">
      <Button
        :title="actionButtonLabel"
        :icon="actionButtonImage"
        :disabled="isPlaceholder"
        :type="actionButtonType"
        @click="actionButtonClicked"
      />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    /** @values default, compact */
    aspect: {
      type: String,
      default: 'default',
      validator(value) {
        return ['default', 'compact'].includes(value)
      },
    },
    containerMode: {
      type: String,
      default: 'contain',
      validator(value) {
        return ['contain', 'fill'].includes(value)
      },
    },
    actionButtonLabel: {
      type: String,
      default: null,
    },
    actionButtonImage: {
      type: String,
      default: null,
    },
    actionButtonType: {
      type: String,
      default: 'primary',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    responsive: {
      type: Boolean,
      default: false,
    },
    noPadding: {
      type: Boolean,
      default: false,
    },
    isPlaceholder: {
      type: Boolean,
      required: false,
    },
    actionButtonFunction: {
      type: String,
      default: '',
    },
    loadingElements: {
      type: Object,
      default() {
        return {}
      },
    },
    actionButtonData: {
      type: Object,
      default() {
        return {}
      },
    },
    coloredBackground: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    actionButtonClicked() {
      this.$emit('actionButtonClicked')
    },
  },
}
</script>

<style lang="postcss" scoped>
.box {
  @apply p-6 transition-opacity duration-500 bg-white rounded-box;

  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.1);

  &.fill-content {
    @apply p-0;

    & .content {
      @apply w-full h-full;
    }
  }

  &.disabled {
    @apply pointer-events-none opacity-25;
  }

  &.compact {
    @apply rounded-2xl py-4 px-5;
  }

  &.no-padding {
    @apply p-0 !important;
  }

  &.with-action {
    @apply pr-3 !important;

    & .content {
      @apply inline-block;

      width: calc(100% - 50px);
    }

    & .action {
      @apply inline-block align-top;

      width: 50px;
    }

    &.with-label {
      & .content {
        width: calc(100% - 155px);
      }

      & .action {
        @apply text-right;

        width: 150px;
      }
    }
  }

  &.colored-background {
    @apply bg-primary;

    box-shadow: 0 10px 30px rgba(239, 13, 64, 0.3);
  }
}

@media only screen and (max-width: 980px) {
  .box {
    &.responsive {
      @apply shadow-none rounded-none;
    }
  }
}
</style>
