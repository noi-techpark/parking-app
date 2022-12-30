<template>
  <div
    class="textarea"
    :class="{
      disabled,
      fill: aspect === 'fill',
      'not-valid': !valid,
    }"
  >
    <InputLabel v-if="label" :text="label" :required="required" />
    <textarea
      ref="input"
      :placeholder="placeholder"
      :value="value"
      :required="required"
      :disabled="disabled"
      @keypress="keypress($event)"
      @input="updateValue($event.target.value)"
      @blur="onBlur($event.target.value)"
    ></textarea>
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
    aspect: {
      type: String,
      default: 'default',
      validator(value) {
        return ['default', 'fill'].includes(value)
      },
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
.textarea {
  & textarea {
    @apply text-base py-3 px-5 bg-input resize-none font-semibold align-top text-black;

    width: 300px;
    min-height: 150px;
    border-radius: 10px;

    &:focus {
      @apply outline-none bg-input-focus;
    }
  }

  &.fill {
    & textarea {
      @apply w-full;
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
