<template>
  <div :class="{ disabled }">
    <InputLabel v-if="title && type === 'switch-on'" :text="title" />
    <div
      class="checkbox"
      :class="{
        'switch-on': type === 'switch-on',
        clickable: type === 'switch-on',
        checked: isChecked,
      }"
      @click="clickInput"
    >
      <div class="input">
        <input
          ref="input"
          v-model="selected"
          :value="value"
          type="checkbox"
          :disabled="disabled"
          @click.stop="preventDefault"
        />
        <icon name="check" />
      </div>
      <label>
        {{ label }}
      </label>
    </div>
  </div>
</template>

<script>
export default {
  model: {
    prop: 'checked',
    event: 'change',
  },

  props: {
    label: {
      type: String,
      default: '',
    },
    checked: {
      type: [Array, Boolean],
      default: false,
    },
    value: {
      type: String,
      default: null,
    },
    title: {
      type: String,
      default: '',
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      default: 'checkbox',
      validator(value) {
        return ['checkbox', 'switch-on'].includes(value)
      },
    },
  },

  data() {
    return {
      isChecked: false,
    }
  },

  computed: {
    selected: {
      get() {
        return this.checked
      },
      set(val) {
        this.isChecked = val
        this.$emit('change', val)
      },
    },
  },

  created() {
    this.isChecked = this.checked
  },

  methods: {
    clickInput() {
      this.$refs.input.click()
    },
    preventDefault() {
      return true
    },
  },
}
</script>

<style lang="postcss" scoped>
.disabled {
  @apply pointer-events-none opacity-25;
}

.checkbox {
  @apply relative inline-block text-black select-none;

  & > .input {
    @apply relative inline-block mr-2 text-center;

    width: 24px;
    height: 24px;

    & > input {
      @apply absolute w-full h-full left-0 top-0 bg-input rounded-md align-top cursor-pointer;

      transition: background 0.2s ease;
      -webkit-appearance: none;

      &:focus {
        @apply outline-none;
      }

      &:checked {
        @apply bg-primary !important;
      }
    }

    & > svg {
      @apply relative inline-block pointer-events-none opacity-0 align-top;

      margin-top: 5px;
      width: 14px;
      height: 14px;
      fill: #fff;
      transition: opacity 0.2s ease, transform 0.2s ease;
      transform: scale(0.5);
    }
  }

  & > label {
    @apply inline-block align-top text-black text-base font-medium leading-tight pt-1;

    max-width: calc(100% - 40px);
  }

  &.checked {
    & > .input {
      & > svg {
        @apply opacity-100;

        transform: scale(1);
      }
    }
  }

  &.switch-on {
    @apply bg-input px-6 rounded-lg;

    height: 50px;
    line-height: 50px;

    & > .input {
      margin-top: 12px;
      & > input {
        background-color: #cfcfcf;
      }
    }
  }
}
</style>
