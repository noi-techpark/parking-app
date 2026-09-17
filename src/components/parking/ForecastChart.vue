<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="forecast">
    <canvas ref="canvas" :aria-label="t('detail.forecast')" role="img" />
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from 'chart.js'

import { readThemeTokens } from '@/lib/theme.js'

// Registering only what is used keeps chart.js out of the bundle's way; the
// whole library would otherwise be pulled in for one line chart.
Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Tooltip
)

const props = defineProps({
  /** [{ minutes, free, freeLow?, freeHigh? }] */
  series: { type: Array, required: true },
})

const { t } = useI18n()
const canvas = ref(null)
let chart = null

function build() {
  if (!canvas.value || !props.series.length) return
  const tokens = readThemeTokens(canvas.value)

  const labels = props.series.map((point) =>
    point.minutes === 0 ? t('detail.now') : t('detail.inMinutes', { value: point.minutes })
  )

  // The confidence band is drawn as a low line plus a high line filled down to
  // it. These bounds were already being fetched and thrown away.
  const hasBand = props.series.some((p) => Number.isFinite(p.freeLow))
  const datasets = [
    {
      data: props.series.map((p) => p.free),
      borderColor: tokens['color-primary-strong'],
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 0,
      tension: 0.35,
      order: 0,
    },
  ]

  if (hasBand) {
    datasets.push(
      {
        data: props.series.map((p) => p.freeLow ?? p.free),
        borderColor: 'transparent',
        pointRadius: 0,
        tension: 0.35,
        order: 2,
      },
      {
        data: props.series.map((p) => p.freeHigh ?? p.free),
        borderColor: 'transparent',
        backgroundColor: 'rgba(0, 156, 221, 0.14)',
        fill: '-1',
        pointRadius: 0,
        tension: 0.35,
        order: 1,
      }
    )
  }

  chart = new Chart(canvas.value, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          filter: (item) => item.datasetIndex === 0,
          callbacks: {
            label: (item) => `${item.formattedValue} ${t('availability.free')}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { size: 10 },
            color: tokens['color-ink-muted'],
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 5,
          },
        },
        y: {
          // Not beginAtZero: a forecast that moves between 600 and 640 spaces
          // reads as a flat line against a 0..1000 axis, which is the one thing
          // this chart exists to show.
          beginAtZero: false,
          grace: '20%',
          grid: { color: tokens['color-border'] },
          ticks: { font: { size: 10 }, color: tokens['color-ink-muted'], maxTicksLimit: 4 },
        },
      },
    },
  })
}

function rebuild() {
  chart?.destroy()
  chart = null
  build()
}

onMounted(build)
onBeforeUnmount(() => {
  chart?.destroy()
  chart = null
})
watch(() => props.series, rebuild)
</script>

<style>
.forecast {
  position: relative;
  height: 8rem;
  padding: 0.5rem;
  background: var(--color-surface-sunken);
  border-radius: 0.5rem;
}
</style>
