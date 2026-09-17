<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <span class="source-badge" :class="`source-badge--${parking.source}`">
    <span class="glyph" aria-hidden="true" />
    {{ label }}
  </span>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * Says what *kind* of parking this is, not who publishes it.
 *
 * On-street bays behave nothing like a garage — a handful of metered spaces on
 * a street versus a multi-storey — and the original app drew them with their own
 * marker. Collapsing the two was a regression; the glyph and label restore the
 * distinction wherever a parking is listed.
 */
const props = defineProps({
  parking: { type: Object, required: true },
})

const { t } = useI18n()

const label = computed(() =>
  t(
    {
      sensor: 'detail.onStreet',
      station: 'detail.station',
      poi: 'detail.poi',
    }[props.parking.source] ?? 'detail.poi'
  )
)
</script>

<style>
.source-badge {
  display: inline-flex;
  flex-shrink: 0;
  gap: 0.25rem;
  align-items: center;
  padding: 0.0625rem 0.375rem;
  font-size: 0.6875rem;
  white-space: nowrap;
  background: var(--color-surface-sunken);
  border-radius: var(--radius-chip);
}

.source-badge .glyph {
  width: 0.5rem;
  height: 0.5rem;
  background: currentcolor;
  opacity: 0.65;
}

/* A garage is a block; a street bay is a flat strip; a POI is a plain point. */
.source-badge--station .glyph {
  border-radius: 0.125rem;
}

.source-badge--sensor .glyph {
  height: 0.25rem;
  border-radius: 999px;
}

.source-badge--poi .glyph {
  border-radius: 50%;
  opacity: 0.4;
}
</style>
