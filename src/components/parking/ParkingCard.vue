<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <button
    type="button"
    class="parking-card"
    :class="{ 'parking-card--selected': selected }"
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
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AvailabilityCard from '@/components/parking/AvailabilityCard.vue'
import StalenessNote from '@/components/parking/StalenessNote.vue'
import Sparkline from '@/components/parking/Sparkline.vue'
import SourceBadge from '@/components/parking/SourceBadge.vue'

const props = defineProps({
  parking: { type: Object, required: true },
  selected: { type: Boolean, default: false },
  now: { type: Number, default: () => Date.now() },
})

defineEmits(['select'])

const { t } = useI18n()

// Absent forecasts leave no trace: a two-line "no forecast published" notice
// took more room than the chart it was apologising for.
const hasForecast = computed(() => (props.parking.forecast?.length ?? 0) > 1)
</script>

<style>
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
