<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <figure v-if="path" class="sparkline" :class="{ 'sparkline--bare': !axis }">
    <div class="plot">
      <template v-if="axis">
        <span class="tick tick--max">{{ max }}</span>
        <span class="tick tick--min">{{ min }}</span>
      </template>

      <svg
        class="chart"
        :viewBox="`0 0 ${W} ${H}`"
        preserveAspectRatio="none"
        role="img"
        :aria-label="description"
      >
        <!-- Gridlines at the series bounds: without them the curve is a shape
             with no magnitude, and 44→48 looks exactly like 0→500. -->
        <template v-if="axis">
          <line class="grid" :x1="0" :y1="PAD" :x2="W" :y2="PAD" />
          <line class="grid" :x1="0" :y1="H - PAD" :x2="W" :y2="H - PAD" />
        </template>
        <path class="area" :d="area" />
        <path class="line" :d="path" />
        <circle class="head" :cx="head[0]" :cy="head[1]" r="2.5" />
      </svg>
    </div>

    <figcaption v-if="axis" class="scale">
      <span>{{ t('detail.now') }}</span>
      <span>{{ t('detail.inMinutes', { value: horizon }) }}</span>
    </figcaption>
  </figure>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

/**
 * A forecast trend in a little SVG, with just enough axis to be meaningful.
 *
 * One chart.js instance per list card would mean dozens of canvases and their
 * render loops on screen at once, so this draws the curve directly. It keeps
 * the two bound gridlines and their values, because an unlabelled auto-scaled
 * curve tells you the shape of the forecast but nothing about its size.
 */
const props = defineProps({
  /** [{ minutes, free }] */
  series: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  /**
   * Show the bound gridlines, their values and the time scale.
   *
   * On by default: an auto-scaled curve on its own conveys the shape of a
   * forecast but nothing about its size. Turn it off where the surrounding
   * context already supplies the magnitude, or where there is no room.
   */
  axis: { type: Boolean, default: true },
})

const { t } = useI18n()

const W = 100
const H = 26
const PAD = 3

const points = computed(() =>
  props.series.filter((p) => Number.isFinite(p.free)).map((p) => p.free)
)

const min = computed(() => (points.value.length ? Math.min(...points.value) : 0))
const max = computed(() => (points.value.length ? Math.max(...points.value) : 0))
const horizon = computed(() => props.series.at(-1)?.minutes ?? 0)

const description = computed(
  () => `${props.label}: ${min.value}–${max.value}`
)

const coords = computed(() => {
  const values = points.value
  if (values.length < 2) return []

  // A perfectly flat forecast would divide by zero; draw it down the middle.
  const span = max.value - min.value || 1
  const stepX = (W - PAD * 2) / (values.length - 1)

  return values.map((value, i) => [
    PAD + i * stepX,
    max.value === min.value
      ? H / 2
      : PAD + (H - PAD * 2) * (1 - (value - min.value) / span),
  ])
})

const path = computed(() => {
  const c = coords.value
  if (!c.length) return ''
  return c.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
})

const area = computed(() => {
  const c = coords.value
  if (!c.length) return ''
  return `${path.value} L${c.at(-1)[0].toFixed(1)} ${H} L${c[0][0].toFixed(1)} ${H} Z`
})

const head = computed(() => coords.value.at(-1) ?? [0, 0])
</script>

<style>
.sparkline {
  margin: 0;
}

.sparkline .plot {
  position: relative;
  /* Room for the tick labels sitting against the left edge. */
  padding-left: 1.5rem;
}

.sparkline--bare .plot,
.sparkline--bare .scale {
  padding-left: 0;
}

.sparkline .chart {
  display: block;
  width: 100%;
  height: 1.75rem;
  overflow: visible;
}

.sparkline .tick {
  position: absolute;
  left: 0;
  width: 1.375rem;
  font-size: 0.5625rem;
  line-height: 1;
  color: var(--color-ink-muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.sparkline .tick--max {
  top: 0;
}

.sparkline .tick--min {
  bottom: 0;
}

.sparkline .grid {
  stroke: var(--color-border);
  stroke-width: 1;
  stroke-dasharray: 2 3;
  vector-effect: non-scaling-stroke;
}

.sparkline .line {
  fill: none;
  stroke: var(--color-primary-strong);
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.sparkline .area {
  fill: var(--color-primary);
  stroke: none;
  opacity: 0.12;
}

.sparkline .head {
  fill: var(--color-primary-strong);
}

.sparkline .scale {
  display: flex;
  justify-content: space-between;
  padding-left: 1.5rem;
  font-size: 0.5625rem;
  line-height: 1.2;
  color: var(--color-ink-muted);
}
</style>
