<template>
  <div>
    <Nuxt class="page" />
    <NotificationCenter />
  </div>
</template>

<style lang="postcss">
html {
  @apply font-sans overflow-hidden;

  font-size: 16px;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
}
</style>
