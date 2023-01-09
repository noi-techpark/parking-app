<template>
  <client-only>
    <notifications
      group="main"
      position="top center"
      classes="notification"
      width="600"
    />
  </client-only>
</template>

<style lang="postcss">
.vue-notification-group {
  width: 600px !important;
  left: calc(50% - 300px) !important;
}

.notification {
  @apply text-white px-6 py-4 text-base rounded-xl;

  margin: 15px 5px 5px 5px;
  background: #44a4fc;
  width: 590px;

  & .notification-content {
    @apply text-center;
  }

  &.warn {
    background: #ffb648;
  }

  &.error {
    background: #e54d42;
  }

  &.success {
    background: #68cd86;
  }
}

@media only screen and (max-width: 980px) {
  .notification {
    width: 280px;
  }
  .vue-notification-group {
    width: 300px !important;
    left: calc(50% - 150px) !important;
  }
}
</style>
