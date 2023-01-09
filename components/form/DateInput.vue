<template>
  <div
    class="date-input"
    :class="{
      disabled,
      fill: aspect === 'fill',
      'not-valid': !valid,
    }"
  >
    <InputLabel v-if="label" :text="label" :required="required" />
    <div>
      <input
        ref="input"
        v-model="date"
        type="date"
        placeholder="YYYY-MM-DD"
        :required="required"
        :disabled="disabled"
        class="inline-block"
        @input="updateValue"
      />
    </div>
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
    value: {
      type: [String, Number],
      default: '',
      validator(value) {
        return !value || String(value).length >= 13
      },
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
    withTimeInput: {
      type: Boolean,
      default: false,
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

  data() {
    return {
      date: '',
      time: '',
    }
  },

  created() {
    if (this.value) {
      const date = new Date(this.value)
      if (date) {
        this.date =
          date.getFullYear() +
          '-' +
          (date.getMonth() + 1) +
          '-' +
          date.getDate()
        this.time = date.getHours() + ':' + date.getMinutes()
      }
    }
  },

  methods: {
    updateValue() {
      const timeDec = this.time ? ' ' + this.time : ''
      const dateDec = this.date + timeDec
      const timestamp = new Date(dateDec).getTime()

      this.$emit('input', timestamp)
    },

    focus() {
      this.$refs.input.focus()
    },

    onBlur(value) {
      this.$emit('blur', value)
    },
  },
}
</script>

<style lang="postcss" scoped>
.date-input {
  & input {
    @apply text-base px-5 bg-input rounded-md resize-none w-full font-semibold;

    width: 190px;
    padding-top: 13px;
    padding-bottom: 13px;

    &:focus {
      @apply outline-none bg-input-focus;
    }
  }

  & .time-input-ct {
    @apply inline-block;

    width: 125px;
    margin-left: 5px;
  }

  &.fill {
    & input {
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
