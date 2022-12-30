<template>
  <div
    class="button clickable"
    :class="{
      loading,
      primary: type === 'primary',
      secondary: type === 'secondary',
      cancel: type === 'cancel',
      md: size === 'md',
      sm: size === 'sm',
      disabled,
      'ico-only': value === '',
      'fill-width': fillWidth,
      'enhanced-contrast': enhancedContrast,
    }"
    @click="clicked"
  >
    <icon v-if="icon !== ''" :name="icon" :type="iconType" />
    {{ value }}
    <Loader
      v-if="loading"
      class="loader-ct"
      :colorscheme="type === 'secondary' ? 'colored' : 'white'"
    />
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: '',
    },
    icon: {
      type: String,
      default: '',
    },
    size: {
      type: String,
      default: 'base',
      validator(value) {
        return ['base', 'md', 'sm'].includes(value)
      },
    },
    fillWidth: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      default: 'primary',
      validator(value) {
        return ['primary', 'secondary'].includes(value)
      },
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    enhancedContrast: {
      type: Boolean,
      default: false,
    },
  },

  computed: {
    iconType() {
      return this.type === 'primary' ? 'primary' : 'secondary'
    },
  },

  methods: {
    clicked() {
      this.$emit('click')
    },
  },
}
</script>

<style lang="postcss" scoped>
.button {
  @apply relative inline-block rounded-lg px-6 text-base font-semibold select-none;

  min-width: 50px;
  height: 50px;
  line-height: 50px;

  & > svg {
    @apply align-top mr-2;

    width: 18px;
    height: 18px;
    margin-top: 16px;
    fill: #fff;
  }

  & > .loader-ct {
    @apply bg-primary rounded-lg;
  }

  &.primary {
    @apply bg-primary text-white;

    &:hover {
      @apply bg-primary-hover;
    }
  }

  &.secondary {
    @apply bg-input text-black;

    &:hover {
      @apply bg-input-focus;
    }

    & > .loader-ct {
      @apply bg-input;

      & > .lds-ellipsis {
        & > div {
          @apply bg-black;
        }
      }
    }

    & > svg {
      fill: #000;
    }
  }

  &.ico-only {
    @apply rounded-button px-0 text-center;

    & > svg {
      @apply mr-0;
    }
  }

  &.loading {
    @apply pointer-events-none;

    cursor: progress;
  }

  &.disabled {
    @apply pointer-events-none opacity-25;
  }

  &.md {
    @apply rounded-lg;

    min-width: 38px;
    height: 38px;

    & > svg {
      margin-top: 11px;
      width: 16px;
      height: 16px;
    }
  }

  &.sm {
    @apply rounded-lg;

    min-width: 30px;
    height: 30px;

    & > svg {
      margin-top: 9px;
      width: 12px;
      height: 12px;
    }
  }

  &.fill-width {
    @apply block text-center;
  }

  &.enhanced-contrast {
    background-color: rgba(255, 255, 255, 0.2);

    &:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }
  }
}
</style>
