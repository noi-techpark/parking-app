<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <header class="brand">
    <span class="mark" aria-hidden="true">P</span>
    <span class="name">{{ t('common.appName') }}</span>
  </header>
</template>

<script setup>
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<style>
.brand {
  display: flex;
  gap: 0.625rem;
  align-items: center;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.brand .mark {
  display: grid;
  place-items: center;
  width: 1.75rem;
  height: 1.75rem;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary-strong);
  border-radius: 0.5rem;
}

.brand .name {
  font-weight: 600;
}
</style>
