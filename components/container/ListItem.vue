<template>
  <div
    class="item clickable"
    :class="{ 'inverted-colorscheme': invertedColorscheme }"
    @click="onClick"
  >
    <p>{{ label }}</p>
    <Icon name="arrow-right-compressed" />
  </div>
</template>

<script>
export default {
  props: {
    label: {
      type: String,
      required: true,
    },
    invertedColorscheme: {
      type: Boolean,
      default: false,
    },
  },

  methods: {
    onClick() {
      this.$emit('click')
    },
  },
}
</script>

<style lang="postcss" scoped>
.item {
  @apply bg-secondary rounded-button cursor-pointer;

  font-size: 0;

  & p {
    @apply inline-block text-base text-black px-6 align-top truncate font-medium;

    line-height: 50px;
    width: calc(100% - 35px);
  }

  & svg {
    @apply inline-block align-top;

    width: 20px;
    height: 20px;
    margin-top: 15px;
    margin-right: 15px;
    fill: theme(colors.black);
  }

  &.inverted-colorscheme {
    @apply bg-white;
  }
}
</style>
