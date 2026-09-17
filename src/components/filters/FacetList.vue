<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <section class="facet">
    <header v-if="!hideHeader" class="facet-head">
      <h3>{{ title }}</h3>
      <button
        v-if="selected.length"
        type="button"
        class="link"
        @click="$emit('clear')"
      >
        {{ t('common.clear') }}
      </button>
    </header>

    <input
      v-if="searchable && options.length > SEARCH_THRESHOLD"
      v-model="query"
      type="search"
      class="facet-search"
      :placeholder="searchPlaceholder"
    />

    <p v-if="!options.length" class="empty">{{ t('filters.none') }}</p>

    <ul v-else class="options">
      <li v-for="option in visible" :key="option.id">
        <label class="option" :class="{ 'option--on': isSelected(option.id) }">
          <input
            type="checkbox"
            :checked="isSelected(option.id)"
            @change="$emit('toggle', option.id)"
          />
          <span class="label">{{ option.name ?? option.id }}</span>
          <span class="count">{{ option.count }}</span>
        </label>
      </li>
    </ul>

    <button
      v-if="ordered.length > limit"
      type="button"
      class="link more"
      @click="expanded = !expanded"
    >
      {{ expanded ? t('filters.showLess') : t('filters.showMore', { count: ordered.length }) }}
    </button>
  </section>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * One multi-select facet. Handles the case this app now has a lot of: 700+
 * municipalities, which needs search and progressive disclosure rather than a
 * row of tabs.
 */
const props = defineProps({
  title: { type: String, required: true },
  /** [{ id, name, count }] */
  options: { type: Array, default: () => [] },
  selected: { type: Array, default: () => [] },
  searchable: { type: Boolean, default: false },
  searchPlaceholder: { type: String, default: '' },
  limit: { type: Number, default: 8 },
  /** The surrounding panel already shows the title and a clear action. */
  hideHeader: { type: Boolean, default: false },
})

defineEmits(['toggle', 'clear'])

const { t } = useI18n()

const SEARCH_THRESHOLD = 8
const query = ref('')
const expanded = ref(false)

const selectedSet = computed(() => new Set(props.selected))
const isSelected = (id) => selectedSet.value.has(id)

const filtered = computed(() => {
  const term = query.value.trim().toLowerCase()
  if (!term) return props.options
  return props.options.filter((option) =>
    String(option.name ?? option.id).toLowerCase().includes(term)
  )
})

/**
 * Selected options sort to the top and stay visible even when the list is
 * collapsed, so the current selection is never hidden behind a "show all".
 */
const ordered = computed(() => {
  const chosen = filtered.value.filter((o) => isSelected(o.id))
  if (!chosen.length) return filtered.value
  return [...chosen, ...filtered.value.filter((o) => !isSelected(o.id))]
})

const visible = computed(() =>
  expanded.value ? ordered.value : ordered.value.slice(0, props.limit)
)
</script>

<style>
.facet {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.facet-head {
  display: flex;
  gap: 0.5rem;
  align-items: baseline;
  justify-content: space-between;
}

.facet-head h3 {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.facet .link {
  padding: 0;
  font: inherit;
  font-size: 0.75rem;
  color: var(--color-primary-strong);
  cursor: pointer;
  background: none;
  border: none;
}

.facet .link:hover {
  text-decoration: underline;
}

.facet-search {
  width: 100%;
  padding: 0.375rem 0.5rem;
  font: inherit;
  font-size: 0.8125rem;
  color: inherit;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
}

.facet-search:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: -1px;
}

.facet .options {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 15rem;
  padding: 0;
  margin: 0;
  overflow-y: auto;
  list-style: none;
}

.facet .option {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.25rem 0.375rem;
  font-size: 0.8125rem;
  cursor: pointer;
  border-radius: 0.375rem;
}

.facet .option:hover {
  background: var(--color-surface-sunken);
}

.facet .option--on {
  font-weight: 600;
}

.facet .option input {
  flex-shrink: 0;
  accent-color: var(--color-primary-strong);
}

.facet .option .label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.facet .option .count {
  flex-shrink: 0;
  font-size: 0.6875rem;
  color: var(--color-ink-muted);
  font-variant-numeric: tabular-nums;
}

.facet .empty {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.facet .more {
  align-self: flex-start;
}
</style>
