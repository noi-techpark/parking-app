<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="card-actions">
    <button
      type="button"
      class="card-actions-trigger"
      :aria-label="t('detail.actions')"
      :title="t('detail.actions')"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span aria-hidden="true">⋮</span>
    </button>

    <div v-if="open" class="card-menu" role="menu">
      <button type="button" role="menuitem" class="card-menu-item" @click="hide">
        {{ t('detail.hide') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  parking: { type: Object, required: true },
})

const emit = defineEmits(['hide'])

const { t } = useI18n()
const open = ref(false)

function hide() {
  open.value = false
  emit('hide', props.parking)
}

function onDocumentPointerDown(event) {
  // composedPath, not contains: from outside the shadow root every event
  // reports the host element as its target.
  if (!event.composedPath().some((node) => node?.classList?.contains?.('card-actions'))) {
    open.value = false
  }
}

watch(open, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})
</script>

<style>
.card-actions {
  position: relative;
}

.card-actions-trigger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font: inherit;
  line-height: 1;
  color: var(--color-ink-muted);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 0.25rem;
}

.card-actions-trigger:hover {
  color: var(--color-ink);
  background: var(--color-surface-sunken);
}

.card-actions-trigger:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 1px;
}

.card-menu {
  position: absolute;
  top: calc(100% + 0.25rem);
  right: 0;
  z-index: 15;
  min-width: 10rem;
  padding: 0.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}

.card-menu-item {
  width: 100%;
  padding: 0.375rem 0.5rem;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--color-ink);
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  border-radius: calc(var(--radius-card) - 2px);
}

.card-menu-item:hover {
  background: var(--color-surface-sunken);
}
</style>
