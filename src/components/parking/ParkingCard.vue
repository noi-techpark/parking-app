<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <!-- A wrapper, because the ⋮ trigger cannot live inside the card's own
       <button> — nested buttons are invalid and browsers unnest them. -->
  <div class="parking-card-shell">
    <button
      type="button"
      class="parking-card"
      :class="{ 'parking-card--selected': selected, 'parking-card--actionable': actions }"
      :aria-pressed="selected"
      @click="$emit('select', parking)"
    >
      <span class="slot">
        <AvailabilityCard :parking="parking" block />
      </span>

      <span class="body">
        <span class="name">{{ parking.name || t('detail.poi') }}</span>

        <span class="meta">
          <!-- Only the unusual kinds are worth calling out; almost everything is
               a parking station and saying so on every card is noise. -->
          <SourceBadge v-if="parking.source !== 'station'" :parking="parking" />
          <span v-if="parking.municipalityName" class="place">
            {{ parking.municipalityName }}
          </span>
          <span v-if="parking.capacity" class="spaces">
            · {{ t('detail.spacesTotal', { count: parking.capacity }) }}
          </span>
        </span>

        <Sparkline
          v-if="hasForecast"
          class="trend"
          :series="parking.forecast"
          :label="t('detail.forecast')"
        />
      </span>

      <StalenessNote class="stale" :parking="parking" :now="now" />
    </button>

    <div v-if="actions" class="card-actions">
      <button
        type="button"
        class="card-actions-trigger"
        :aria-label="t('detail.actions')"
        :title="t('detail.actions')"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        @click="menuOpen = !menuOpen"
      >
        <span aria-hidden="true">⋮</span>
      </button>

      <div v-if="menuOpen" class="card-menu" role="menu">
        <button type="button" role="menuitem" class="card-menu-item" @click="hide">
          {{ t('detail.hide') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'

import AvailabilityCard from '@/components/parking/AvailabilityCard.vue'
import StalenessNote from '@/components/parking/StalenessNote.vue'
import Sparkline from '@/components/parking/Sparkline.vue'
import SourceBadge from '@/components/parking/SourceBadge.vue'

const props = defineProps({
  parking: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  now: { type: Number, default: () => Date.now() },
  /** Whether to offer the ⋮ menu. Off leaves the card exactly as it was. */
  actions: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'hide'])

const { t } = useI18n()
const menuOpen = ref(false)

function hide() {
  menuOpen.value = false
  emit('hide', props.parking)
}

function onDocumentPointerDown(event) {
  // composedPath, not contains: from outside the shadow root every event
  // reports the host element as its target.
  if (!event.composedPath().some((node) => node?.classList?.contains?.('card-actions'))) {
    menuOpen.value = false
  }
}

watch(menuOpen, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('pointerdown', onDocumentPointerDown, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown, true)
})

// Absent forecasts leave no trace: a two-line "no forecast published" notice
// took more room than the chart it was apologising for.
const hasForecast = computed(() => (props.parking.forecast?.length ?? 0) > 1)
</script>

<style>
.parking-card-shell {
  position: relative;
  height: 100%;
}

.card-actions {
  position: absolute;
  top: 0.25rem;
  right: 0.25rem;
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
  opacity: 0;
}

/* No hover to reveal it on touch, so it stays drawn there. */
@media (hover: none) {
  .card-actions-trigger {
    opacity: 1;
  }
}

.card-actions-trigger:hover {
  color: var(--color-ink);
  background: var(--color-surface-sunken);
}

.card-actions-trigger:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 1px;
}

/* Revealed on approach rather than always drawn: a permanent ⋮ on 1,400 cards
   is visual noise for an action almost nobody takes. Kept reachable without
   hover, for keyboard and touch. */
.card-actions-trigger:focus-visible,
.card-actions-trigger[aria-expanded='true'] {
  opacity: 1;
}

.parking-card-shell:hover .card-actions-trigger {
  opacity: 1;
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

/* Keeps the name clear of the trigger. */
.parking-card--actionable .name {
  padding-right: 1.25rem;
}

/*
 * Two columns: availability on the left to scan down, identity and trend on the
 * right, freshness underneath both.
 */
.parking-card {
  display: grid;
  grid-template-areas:
    'slot body'
    'stale stale';
  grid-template-columns: 4rem 1fr;
  gap: 0.25rem 0.625rem;
  width: 100%;
  height: 100%;
  padding: 0.625rem;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.parking-card:hover {
  border-color: var(--color-primary);
}

.parking-card:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: 2px;
}

.parking-card--selected {
  border-color: var(--color-primary-strong);
  box-shadow: inset 0 0 0 1px var(--color-primary-strong);
}

.parking-card .slot {
  grid-area: slot;
  align-self: stretch;
}

.parking-card .body {
  display: flex;
  grid-area: body;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.parking-card .name {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.parking-card .meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  align-items: center;
  min-width: 0;
  font-size: 0.6875rem;
  line-height: 1.3;
  color: var(--color-ink-muted);
}

.parking-card .place {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.parking-card .spaces {
  white-space: nowrap;
}

.parking-card .trend {
  margin-top: 0.125rem;
}

.parking-card .stale {
  grid-area: stale;
}
</style>
