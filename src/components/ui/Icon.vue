<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <span class="icon" :class="{ 'icon--missing': !markup }" v-html="markup" />
</template>

<script setup>
import { computed } from 'vue'

// Replaces webpack's require.context. Every icon is bundled eagerly as raw
// markup so it can be inlined into the shadow root — a webcomponent has no
// sibling asset directory to fetch sprites from.
const icons = import.meta.glob('@/assets/icon/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const byName = Object.fromEntries(
  Object.entries(icons).map(([path, markup]) => [
    path.slice(path.lastIndexOf('/') + 1, -4),
    markup,
  ])
)

const props = defineProps({
  name: { type: String, required: true },
})

const markup = computed(() => {
  const found = byName[props.name]
  if (!found) {
    console.warn(`[parking-app] icon not found: ${props.name}`)
    return byName['broken-image'] ?? ''
  }
  return found
})
</script>

<style>
.icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon > svg {
  width: 100%;
  height: 100%;
  fill: currentcolor;
}
</style>
