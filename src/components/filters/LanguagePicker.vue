<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="lang-picker">
    <button
      type="button"
      class="lang-trigger"
      :class="{ 'lang-trigger--open': open }"
      :aria-label="t('filters.language')"
      :title="t('filters.language')"
      :aria-expanded="open"
      aria-haspopup="menu"
      @click="open = !open"
    >
      <span class="gear" aria-hidden="true">⚙</span>
      <span class="code">{{ short(modelValue) }}</span>
    </button>

    <div v-if="open" class="lang-menu" role="menu">
      <button
        v-for="option in SUPPORTED"
        :key="option"
        type="button"
        role="menuitemradio"
        :aria-checked="option === modelValue"
        class="lang-option"
        :class="{ 'lang-option--current': option === modelValue }"
        @click="pick(option)"
      >
        <span class="label">{{ NATIVE_NAME[option] }}</span>
        <span class="tick" aria-hidden="true">{{ option === modelValue ? '✓' : '' }}</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { SUPPORTED, toIso1 } from '@/lib/locale.js'

/**
 * Language switch, rendered as a gear beside the filter pills.
 *
 * Each language is named in itself — someone looking for German cannot be
 * assumed to read the current interface language well enough to find it.
 */
const NATIVE_NAME = {
  eng: 'English',
  ita: 'Italiano',
  deu: 'Deutsch',
}

const props = defineProps({
  modelValue: { type: String, required: true },
})

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()
const open = ref(false)

const short = (locale) => toIso1(locale).toUpperCase()

function pick(option) {
  open.value = false
  if (option !== props.modelValue) emit('update:modelValue', option)
}

function onDocumentPointerDown(event) {
  // composedPath, not contains: inside a shadow root the event target reported
  // to the document is the host element, so contains() matches everything.
  if (!event.composedPath().some((node) => node?.classList?.contains?.('lang-picker'))) {
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
.lang-picker {
  position: relative;
}

.lang-trigger {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  padding: 0.375rem 0.5rem;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-ink);
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 1px 4px rgb(0 0 0 / 16%);
}

.lang-trigger .gear {
  font-size: 0.875rem;
  color: var(--color-ink-muted);
}

.lang-trigger:hover,
.lang-trigger--open {
  border-color: var(--color-primary-strong);
}

.lang-trigger:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 2px;
}

.lang-menu {
  position: absolute;
  top: calc(100% + 0.375rem);
  left: 0;
  z-index: 20;
  min-width: 9rem;
  padding: 0.25rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 6px 20px rgb(0 0 0 / 18%);
}

.lang-option {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
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

.lang-option:hover {
  background: var(--color-surface-sunken);
}

.lang-option--current {
  font-weight: 600;
  color: var(--color-primary-strong);
}

.lang-option .tick {
  color: var(--color-primary-strong);
}
</style>
