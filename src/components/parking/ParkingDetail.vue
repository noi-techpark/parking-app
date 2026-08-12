<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <article class="detail">
    <header class="head">
      <div class="titles">
        <h2>{{ parking.name || t('detail.poi') }}</h2>
        <p class="place">
          <span v-if="parking.municipalityName">{{ parking.municipalityName }}</span>
          <span v-if="parking.municipalityApprox" class="approx">
            · {{ t('detail.approximate') }}
          </span>
        </p>
      </div>
      <button type="button" class="close" :aria-label="t('common.close')" @click="$emit('close')">
        ×
      </button>
    </header>

    <div class="headline">
      <AvailabilityCard :parking="parking" size="lg" />
      <div class="facts">
        <StalenessNote :parking="parking" :now="now" />
        <p v-if="parking.capacityUnknown" class="fact">
          {{ t('availability.unknownCapacity') }}
        </p>
        <p v-else-if="parking.capacity" class="fact">
          {{ t('detail.capacity') }}: {{ parking.capacity }} {{ t('detail.spaces') }}
        </p>
        <p class="fact">{{ t('detail.source') }}: {{ parking.origin ?? '—' }} · {{ kindLabel }}</p>
      </div>
    </div>

    <section class="forecast-section">
      <h3>{{ t('detail.forecast') }}</h3>
      <p v-if="parking.forecast === null" class="hint">{{ t('detail.forecastLoading') }}</p>
      <p v-else-if="!parking.forecast.length" class="hint">{{ t('detail.forecastNone') }}</p>
      <ForecastChart v-else :series="parking.forecast" />
    </section>

    <a class="navigate" :href="directionsUrl" target="_blank" rel="noopener">
      {{ t('detail.navigate') }}
    </a>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AvailabilityCard from '@/components/parking/AvailabilityCard.vue'
import StalenessNote from '@/components/parking/StalenessNote.vue'
import ForecastChart from '@/components/parking/ForecastChart.vue'

const props = defineProps({
  parking: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
})

defineEmits(['close'])

const { t } = useI18n()

const kindLabel = computed(() =>
  t(
    {
      station: 'detail.station',
      sensor: 'detail.onStreet',
      poi: 'detail.poi',
    }[props.parking.source] ?? 'detail.poi'
  )
)

// A plain maps link: no SDK, no API key, nothing proprietary loaded into the page.
const directionsUrl = computed(
  () =>
    `https://www.google.com/maps/dir/?api=1&destination=${props.parking.coord.lat},${props.parking.coord.lon}&travelmode=driving`
)
</script>

<style>
.detail {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.detail .head {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
}

.detail .titles {
  flex: 1;
  min-width: 0;
}

.detail h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  line-height: 1.25;
}

.detail .place {
  margin: 0.125rem 0 0;
  font-size: 0.8125rem;
  color: var(--color-ink-muted);
}

.detail .approx {
  font-style: italic;
}

.detail .close {
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  font-size: 1.25rem;
  line-height: 1;
  color: var(--color-ink-muted);
  cursor: pointer;
  background: var(--color-surface-sunken);
  border: none;
  border-radius: 50%;
}

.detail .close:hover {
  color: var(--color-ink);
}

.detail .headline {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
}

.detail .facts {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.1875rem;
  min-width: 10rem;
}

.detail .fact {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.detail .forecast-section h3 {
  margin: 0 0 0.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--color-ink-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.detail .hint {
  margin: 0;
  font-size: 0.8125rem;
  color: var(--color-ink-muted);
}

.detail .navigate {
  padding: 0.625rem 1rem;
  font-size: 0.9375rem;
  font-weight: 600;
  color: #fff;
  text-align: center;
  text-decoration: none;
  background: var(--color-primary-strong);
  border-radius: var(--radius-button);
}

.detail .navigate:hover {
  filter: brightness(1.08);
}
</style>
