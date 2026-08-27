<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="active-filters">
    <p class="count">{{ t('filters.results', count) }}</p>

    <ul v-if="chips.length" class="chips">
      <li v-for="chip in chips" :key="`${chip.facet}:${chip.id}`">
        <button
          type="button"
          class="chip"
          :aria-label="t('filters.removeFilter', { name: chip.label })"
          @click="$emit('remove', chip)"
        >
          <span class="label">{{ chip.label }}</span>
          <span class="x" aria-hidden="true">×</span>
        </button>
      </li>
      <li>
        <button type="button" class="clear" @click="$emit('clear')">
          {{ t('common.clearAll') }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

/**
 * Shows what is currently filtered, and lets each condition be dropped
 * individually.
 *
 * The filter panels are closed nearly all the time, so without this the current
 * selection would only be visible as a number on a pill.
 */
defineProps({
  /** [{ facet, id, label }] */
  chips: { type: Array, default: () => [] },
  count: { type: Number, default: 0 },
})

defineEmits(['remove', 'clear'])

const { t } = useI18n()
</script>

<style>
.active-filters {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  padding: 0 0.875rem;
}

.active-filters .count {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.active-filters .chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0;
  margin: 0;
  list-style: none;
}

/* Flex items refuse to shrink below their content by default, so without this
   a long label pushes the chip — and its × — past the rail. */
.active-filters .chips > li {
  min-width: 0;
  max-width: 100%;
}

.active-filters .chip {
  display: inline-flex;
  gap: 0.25rem;
  align-items: center;
  max-width: 100%;
  padding: 0.125rem 0.25rem 0.125rem 0.5rem;
  font: inherit;
  font-size: 0.75rem;
  color: var(--color-ink);
  cursor: pointer;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  border-radius: 999px;
}

/* Truncation has to happen on the text itself: text-overflow does nothing for
   a flex container's own text, and the × was being pushed out of view. */
.active-filters .chip .label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.active-filters .chip:hover {
  border-color: var(--color-primary-strong);
}

.active-filters .chip .x {
  flex: none;
  font-size: 0.875rem;
  line-height: 1;
  color: var(--color-primary-strong);
}

.active-filters .clear {
  padding: 0.125rem 0.5rem;
  font: inherit;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
  cursor: pointer;
  background: none;
  border: none;
}

.active-filters .clear:hover {
  color: var(--color-ink);
  text-decoration: underline;
}
</style>
