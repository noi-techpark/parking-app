<template>
  <p>{{ text }}</p>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: '',
    },
  },
}
</script>

<style lang="postcss" scoped>
p {
  @apply text-grey text-xs mt-1 font-semibold;
}
</style>
