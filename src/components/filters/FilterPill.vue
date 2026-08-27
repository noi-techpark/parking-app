<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <button
    type="button"
    class="filter-pill"
    :class="{ 'filter-pill--active': active, 'filter-pill--open': open }"
    :disabled="disabled"
    :aria-expanded="open"
    aria-haspopup="dialog"
    @click="$emit('toggle')"
  >
    <span class="title">
      <span class="glyph" aria-hidden="true">☰</span>
      {{ title }}
    </span>
    <span class="value"><span class="value-text">{{ value }}</span></span>
  </button>
</template>

<script setup>
/**
 * Compact filter trigger, split into label and current value.
 *
 * Follows the pattern from opendatahub-analytics-v2's MapFilter: the pill has
 * to state what is currently selected, because the panel behind it is closed
 * almost all of the time and the selection would otherwise be invisible.
 */
defineProps({
  title: { type: String, required: true },
  /** Always show something — a count, or the word for "all". */
  value: { type: String, required: true },
  active: { type: Boolean, default: false },
  open: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

defineEmits(['toggle'])
</script>

<style>
.filter-pill {
  display: inline-flex;
  align-items: stretch;
  font: inherit;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-ink);
  cursor: pointer;
  user-select: none;
  background: none;
  border: none;
  border-radius: var(--radius-card);
  box-shadow: 0 1px 4px rgb(0 0 0 / 16%);
}

.filter-pill .title {
  display: inline-flex;
  gap: 0.3125rem;
  align-items: center;
  padding: 0.375rem 0.625rem;
  white-space: nowrap;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-right: none;
  border-radius: var(--radius-card) 0 0 var(--radius-card);
}

.filter-pill .glyph {
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.filter-pill .value {
  display: inline-flex;
  align-items: center;
  /* A single selected parking's name can be longer than the whole filter bar. */
  max-width: 12rem;
  padding: 0.375rem 0.5rem;
  white-space: nowrap;
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: 0 var(--radius-card) var(--radius-card) 0;
}

/* On the text, not the box: text-overflow does nothing for a flex container. */
.filter-pill .value-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.filter-pill--active .value {
  color: #fff;
  background: var(--color-primary-strong);
  border-color: var(--color-primary-strong);
}

.filter-pill--open .title,
.filter-pill--open .value {
  border-color: var(--color-primary-strong);
}

.filter-pill:hover .title,
.filter-pill:hover .value {
  border-color: var(--color-primary);
}

.filter-pill:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 2px;
}

.filter-pill:disabled {
  pointer-events: none;
  opacity: 0.6;
}
</style>
