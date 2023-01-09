<template>
  <label> {{ text }} <sup v-if="required" class="text-red">*</sup> </label>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: ''
    },
    required: {
      type: Boolean,
      default: false
    }
  }
}
</script>

<style lang="postcss" scoped>
label {
  @apply block text-sm text-black mb-1;
}
</style>
