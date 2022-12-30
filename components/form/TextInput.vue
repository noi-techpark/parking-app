<template>
  <div
    class="text-input"
    :class="{
      disabled,
      fill: aspect === 'fill',
      'not-valid': !valid,
      'inverted-colorscheme': invertedColorscheme,
      transparent,
    }"
  >
    <InputLabel v-if="label" :text="label" :required="required" />
    <input
      ref="input"
      :type="type"
      :placeholder="placeholder"
      :name="name"
      :value="value"
      :required="required"
      :disabled="disabled"
      @keypress="keypress($event)"
      @input="updateValue($event.target.value)"
      @blur="onBlur($event.target.value)"
    />
    <InputDescription v-if="description" :text="description" />
  </div>
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      default: '',
    },
    placeholder: {
      type: String,
      default: '',
    },
    value: {
      type: [String, Number],
      default: '',
    },
    type: {
      type: String,
      default: 'text',
      validator(value) {
        return [
          'text',
          'number',
          'tel',
          'email',
          'search',
          'password',
          'hidden',
        ].includes(value)
      },
    },
    aspect: {
      type: String,
      default: 'default',
      validator(value) {
        return ['default', 'fill'].includes(value)
      },
    },
    name: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      default: '',
    },
    required: {
      type: Boolean,
      default: false,
    },
    disabled: {
      type: Boolean,
      default: false,
    },
    valid: {
      type: Boolean,
      default: true,
    },
    invertedColorscheme: {
      type: Boolean,
      default: false,
    },
    transparent: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    updateValue(value) {
      this.$emit('input', value)
    },

    focus() {
      this.$refs.input.focus()
    },

    keypress(event) {
      switch (event.keyCode) {
        case 13:
          this.$emit('onEnter')
          break
      }
    },

    onBlur(value) {
      this.$emit('blur', value)
    },
  },
}
</script>

<style lang="postcss" scoped>
.text-input {
  & input {
    @apply text-base px-5 bg-input resize-none text-black font-medium;

    width: 300px;
    padding-top: 10px;
    padding-bottom: 10px;
    border-radius: 10px;

    &:focus {
      @apply outline-none bg-input-focus;
    }

    &[type='search'] {
      @apply bg-no-repeat;

      padding-right: 50px;
      background-image: url(~assets/icon/search.svg?inline);
      background-position: calc(100% - 20px) center;
      background-size: 18px auto;
    }
  }

  &.transparent {
    & input {
      @apply bg-transparent !important;
    }
  }

  &.fill {
    & input {
      @apply w-full;
    }
  }

  &.inverted-colorscheme {
    & input {
      @apply bg-white;
    }
  }

  &.not-valid {
    & input {
      @apply bg-light-red;

      &:focus {
        @apply bg-light-red-focus;
      }
    }
  }

  &.disabled {
    @apply pointer-events-none opacity-25;
  }
}
</style>
