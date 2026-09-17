<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    class="availability"
    :class="[
      `availability--${level}`,
      `availability--${size}`,
      { 'availability--block': block },
    ]"
  >
    <span class="value">{{ value }}<span v-if="suffix" class="suffix">{{ suffix }}</span></span>
    <span class="unit">{{ unit }}</span>
    <span v-if="block && fraction !== null" class="bar" aria-hidden="true">
      <span class="fill" :style="{ width: `${Math.round(fraction * 100)}%` }" />
    </span>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  AVAILABILITY_KIND,
  availabilityLevel,
  freeFraction,
} from '@/lib/availability.js'

/**
 * Renders availability the way the source actually expresses it.
 *
 * Deliberately reduced to one headline figure and one word. The earlier version
 * stacked "66 / free / 75" and read as three unrelated numbers; the total now
 * lives in the card's meta line where it belongs, and the fill bar carries the
 * proportion far more legibly than a denominator did.
 */
const props = defineProps({
  parking: { type: Object, required: true },
  size: {
    type: String,
    default: 'md',
    validator: (v) => ['sm', 'md', 'lg'].includes(v),
  },
  /** Fills its container and shows a fill bar, for list cards. */
  block: { type: Boolean, default: false },
})

const { t } = useI18n()

const level = computed(() => availabilityLevel(props.parking))
const fraction = computed(() => freeFraction(props.parking))

const LEVEL_LABELS = {
  LOW: 'availability.occupancyLow',
  MEDIUM: 'availability.occupancyMedium',
  HIGH: 'availability.occupancyHigh',
}

const value = computed(() => {
  switch (props.parking.availabilityKind) {
    case AVAILABILITY_KIND.COUNT:
      return Number.isFinite(props.parking.free) ? String(props.parking.free) : '—'
    case AVAILABILITY_KIND.RATIO:
      return fraction.value === null ? '—' : String(Math.round(fraction.value * 100))
    case AVAILABILITY_KIND.LEVEL:
      return t(LEVEL_LABELS[props.parking.occupancyLevel] ?? 'availability.noRealtime')
    default:
      return '—'
  }
})

const suffix = computed(() =>
  props.parking.availabilityKind === AVAILABILITY_KIND.RATIO ? '%' : ''
)

const unit = computed(() => {
  switch (props.parking.availabilityKind) {
    case AVAILABILITY_KIND.COUNT:
    case AVAILABILITY_KIND.RATIO:
      return t('availability.free')
    case AVAILABILITY_KIND.LEVEL:
      return ''
    default:
      return t('availability.noData')
  }
})
</script>

<style>
/*
 * Pastel fill with ink text throughout. Measured against WCAG, white text on
 * these hues reached only 1.6:1; ink clears 6:1 on all of them.
 */
.availability {
  display: inline-flex;
  gap: 0.25rem;
  align-items: baseline;
  padding: 0.375rem 0.625rem;
  color: var(--color-ink);
  white-space: nowrap;
  background: var(--color-avail-none);
  border: 1px solid var(--color-avail-none-strong);
  border-radius: var(--radius-card);
}

.availability--high {
  background: var(--color-avail-high);
  border-color: var(--color-avail-high-strong);
}

.availability--mid {
  background: var(--color-avail-mid);
  border-color: var(--color-avail-mid-strong);
}

.availability--low {
  background: var(--color-avail-low);
  border-color: var(--color-avail-low-strong);
}

.availability--unknown {
  color: var(--color-ink-muted);
  background: var(--color-surface-sunken);
  border-color: var(--color-border);
}

.availability .value {
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.availability .suffix {
  font-size: 0.7em;
  font-weight: 600;
}

.availability .unit {
  font-size: 0.75rem;
}

/* Block: the list-card form — figure, label, fill bar, centred. */
.availability--block {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0.5rem 0.375rem;
  text-align: center;
}

.availability--block .value {
  font-size: 1.5rem;
}

.availability--block .unit {
  font-size: 0.6875rem;
  line-height: 1;
  opacity: 0.8;
}

.availability--block .bar {
  width: 100%;
  height: 0.1875rem;
  margin-top: 0.25rem;
  overflow: hidden;
  background: rgb(0 0 0 / 14%);
  border-radius: 999px;
}

.availability--block .fill {
  display: block;
  height: 100%;
  background: currentcolor;
  opacity: 0.55;
}

.availability--sm {
  padding: 0.25rem 0.5rem;
}

.availability--sm .value {
  font-size: 1rem;
}

.availability--lg {
  padding: 0.625rem 1rem;
}

.availability--lg .value {
  font-size: 2rem;
}
</style>
