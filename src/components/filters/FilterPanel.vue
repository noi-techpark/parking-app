<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    ref="panel"
    class="filter-panel"
    role="dialog"
    :aria-label="title"
    @keydown.esc="$emit('close')"
  >
    <header class="panel-head">
      <h2>{{ title }}</h2>
      <button
        type="button"
        class="panel-close"
        :aria-label="t('common.close')"
        @click="$emit('close')"
      >
        ×
      </button>
    </header>

    <div class="panel-body">
      <slot />
    </div>

    <footer class="panel-foot">
      <button type="button" class="ghost" @click="$emit('clear')">
        {{ t('common.clearAll') }}
      </button>
      <button type="button" class="primary" @click="$emit('close')">
        {{ t('common.done') }}
      </button>
    </footer>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Floating panel opened by a FilterPill.
 *
 * Closes on outside click and on Escape. The listener is registered on the
 * shadow root rather than document, because a click inside a shadow tree is
 * retargeted at the host by the time it reaches the document and every click
 * would look "outside".
 */
defineProps({
  title: { type: String, required: true },
})

const emit = defineEmits(['close', 'clear'])

const { t } = useI18n()
const panel = ref(null)
let root = null
let armed = 0

function onPointerDown(event) {
  const path = event.composedPath?.() ?? []
  if (panel.value && !path.includes(panel.value)) emit('close')
}

onMounted(() => {
  root = panel.value?.getRootNode() ?? document
  // Deferred: the click that opened the panel is still propagating, and would
  // otherwise be seen as an outside click that closes it again immediately.
  armed = requestAnimationFrame(() => {
    armed = 0
    // The panel can be closed again before this frame runs.
    root?.addEventListener('pointerdown', onPointerDown)
  })
  panel.value?.focus?.()
})

onBeforeUnmount(() => {
  if (armed) cancelAnimationFrame(armed)
  armed = 0
  root?.removeEventListener('pointerdown', onPointerDown)
  root = null
})
</script>

<style>
.filter-panel {
  display: flex;
  flex-direction: column;
  width: min(20rem, calc(100vw - 2rem));
  max-height: min(26rem, 70vh);
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-box);
  box-shadow: 0 6px 24px rgb(0 0 0 / 18%);
}

.filter-panel .panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.5rem 0.625rem 0.875rem;
  border-bottom: 1px solid var(--color-border);
}

.filter-panel .panel-head h2 {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 700;
}

.filter-panel .panel-close {
  width: 1.75rem;
  height: 1.75rem;
  font-size: 1.125rem;
  line-height: 1;
  color: var(--color-ink-muted);
  cursor: pointer;
  background: none;
  border: none;
  border-radius: 50%;
}

.filter-panel .panel-close:hover {
  background: var(--color-surface-sunken);
}

.filter-panel .panel-body {
  flex: 1;
  min-height: 0;
  padding: 0.75rem 0.875rem;
  overflow-y: auto;
}

.filter-panel .panel-foot {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem 0.875rem;
  border-top: 1px solid var(--color-border);
}

.filter-panel .ghost {
  padding: 0;
  font: inherit;
  font-size: 0.8125rem;
  color: var(--color-ink-muted);
  cursor: pointer;
  background: none;
  border: none;
}

.filter-panel .ghost:hover {
  color: var(--color-ink);
  text-decoration: underline;
}

.filter-panel .primary {
  padding: 0.375rem 1rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  background: var(--color-primary-strong);
  border: none;
  border-radius: var(--radius-button);
}

.filter-panel .primary:hover {
  filter: brightness(1.08);
}
</style>
