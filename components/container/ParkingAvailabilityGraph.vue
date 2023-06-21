<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div class="availability-graph">
    <client-only>
      <LineChart
        :options="chartSettings"
        :height="75"
        :chart-data="chartData"
      />
    </client-only>
  </div>
</template>

<script>
'use strict'
import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfigFile from '~/tailwind.config'
const tailwindConfig = resolveConfig(tailwindConfigFile)

export default {
  props: {
    forecast: {
      type: Array,
      required: true,
    },
    limitDataset: {
      type: Number,
      default: null,
    },
  },

  data() {
    return {
      tailwindConfig,
      chartSettings: {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
          display: false,
        },
        title: {
          display: false,
        },
        scales: {
          xAxes: [
            {
              display: true,
              ticks: {
                fontSize: 10,
              },
              gridLines: {
                color: '#e0e0e0',
              },
            },
          ],
          yAxes: [
            {
              display: true,
              ticks: {
                beginAtZero: false,
                autoSkip: true,
                maxTicksLimit: 4,
                fontSize: 10,
              },
              gridLines: {
                color: '#e0e0e0',
              },
            },
          ],
        },
      },
    }
  },

  computed: {
    values() {
      if (this.limitDataset) {
        return this.forecast.slice(0, this.limitDataset)
      }

      return this.forecast
    },

    labels() {
      return this.values.map(
        (value) => '+' + Math.round(value.mperiod / 60) + this.$t('common.min')
      )
    },

    chartData() {
      return {
        labels: this.labels,
        datasets: [
          {
            pointRadius: 0,
            borderColor: this.tailwindConfig.theme.colors.primary,
            backgroundColor: 'transparent',
            data: this.values.map((value) => value.mvalue),
            tension: 0.5,
          },
        ],
      }
    },
  },
}
</script>

<style lang="postcss" scoped>
.availability-graph {
  @apply relative;

  height: 75px;
}
</style>
