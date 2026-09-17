<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <p v-if="text" class="staleness" :class="`staleness--${tone}`">
    <span v-if="tone !== 'ok'" class="dot" aria-hidden="true" />
    {{ text }}
  </p>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { CATEGORY } from '@/lib/availability.js'
import { relativeAge } from '@/lib/duration.js'

/**
 * Says how old a reading is, and shouts when that matters (requirement 11).
 *
 * The three components that previously showed timestamps each hardcoded their
 * own staleness threshold and printed a raw date, so a reading from 2025 looked
 * exactly like one from a minute ago.
 */
const props = defineProps({
  parking: { type: Object, required: true },
  now: { type: Number, default: () => Date.now() },
})

const { t } = useI18n()

const tone = computed(() => {
  if (props.parking.category === CATEGORY.DELAYED) return 'warn'
  if (props.parking.category === CATEGORY.STATIC) return 'muted'
  return 'ok'
})

const KEYS = {
  second: 'staleness.updatedSecondsAgo',
  minute: 'staleness.updatedMinutesAgo',
  hour: 'staleness.updatedHoursAgo',
  day: 'staleness.updatedDaysAgo',
}

const text = computed(() => {
  if (!props.parking.lastUpdate) {
    return props.parking.category === CATEGORY.STATIC ? '' : t('staleness.never')
  }
  const age = relativeAge(props.now - props.parking.lastUpdate)
  if (!age) return ''
  return t(KEYS[age.unit], age.value, { named: { value: age.value } })
})
</script>

<style>
.staleness {
  display: inline-flex;
  gap: 0.375rem;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-ink-muted);
}

.staleness--warn {
  font-weight: 600;
  color: var(--color-warn-strong);
}

.staleness--muted {
  color: var(--color-ink-muted);
}

.staleness .dot {
  width: 0.4375rem;
  height: 0.4375rem;
  background: currentcolor;
  border-radius: 50%;
}
</style>
