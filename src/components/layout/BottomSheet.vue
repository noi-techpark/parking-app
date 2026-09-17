<!--
SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>

SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
  <div
    ref="sheet"
    class="sheet"
    :class="{ 'sheet--dragging': dragging }"
    :style="{ transform: `translateY(${offset}px)` }"
  >
    <div
      ref="grip"
      class="grip"
      role="slider"
      tabindex="0"
      :aria-valuemin="0"
      :aria-valuemax="SNAPS.length - 1"
      :aria-valuenow="snapIndex"
      :aria-label="label"
      @pointerdown="onPointerDown"
      @keydown.up.prevent="snapTo(snapIndex + 1)"
      @keydown.down.prevent="snapTo(snapIndex - 1)"
    >
      <span class="bar" />
    </div>
    <div class="content">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Draggable bottom sheet with three snap points.
 *
 * Replaces the original drag implementation, which attached mousemove and
 * touchmove handlers to `window` and never removed them — every time the
 * webcomponent was torn down it left them behind. Here the move/up handlers
 * live on the pointer capture and are released with it, and everything is
 * unwound on unmount.
 */
defineProps({
  label: { type: String, default: 'Resize panel' },
})

/** Fraction of the container height that stays visible at each snap. */
const SNAPS = [0.28, 0.62, 0.95]
const DEFAULT_SNAP = 0

const sheet = ref(null)
const grip = ref(null)
const snapIndex = ref(DEFAULT_SNAP)
const offset = ref(0)
const dragging = ref(false)

let startY = 0
let startOffset = 0
let height = 0
let activePointer = null

function containerHeight() {
  return sheet.value?.parentElement?.clientHeight ?? window.innerHeight
}

function offsetForSnap(index) {
  height = containerHeight()
  return Math.round(height * (1 - SNAPS[index]))
}

function snapTo(index) {
  const clamped = Math.max(0, Math.min(SNAPS.length - 1, index))
  snapIndex.value = clamped
  offset.value = offsetForSnap(clamped)
}

function onPointerDown(event) {
  activePointer = event.pointerId
  grip.value.setPointerCapture(activePointer)
  startY = event.clientY
  startOffset = offset.value
  height = containerHeight()
  dragging.value = true

  grip.value.addEventListener('pointermove', onPointerMove)
  grip.value.addEventListener('pointerup', onPointerUp)
  grip.value.addEventListener('pointercancel', onPointerUp)
}

function onPointerMove(event) {
  if (!dragging.value) return
  const max = offsetForSnap(0)
  const min = offsetForSnap(SNAPS.length - 1)
  offset.value = Math.max(min, Math.min(max, startOffset + (event.clientY - startY)))
}

function onPointerUp() {
  if (!dragging.value) return
  dragging.value = false
  releasePointer()

  // Settle on whichever snap point ended up closest.
  let nearest = 0
  let best = Infinity
  SNAPS.forEach((_, index) => {
    const distance = Math.abs(offsetForSnap(index) - offset.value)
    if (distance < best) {
      best = distance
      nearest = index
    }
  })
  snapTo(nearest)
}

function releasePointer() {
  if (!grip.value) return
  grip.value.removeEventListener('pointermove', onPointerMove)
  grip.value.removeEventListener('pointerup', onPointerUp)
  grip.value.removeEventListener('pointercancel', onPointerUp)
  if (activePointer !== null && grip.value.hasPointerCapture?.(activePointer)) {
    grip.value.releasePointerCapture(activePointer)
  }
  activePointer = null
}

function onResize() {
  snapTo(snapIndex.value)
}

onMounted(() => {
  snapTo(DEFAULT_SNAP)
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  releasePointer()
  window.removeEventListener('resize', onResize)
})

defineExpose({ snapTo, expand: () => snapTo(SNAPS.length - 1), collapse: () => snapTo(0) })
</script>

<style>
.sheet {
  position: absolute;
  inset: 0 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-surface);
  border-radius: 1rem 1rem 0 0;
  box-shadow: 0 -2px 16px rgb(0 0 0 / 14%);
  transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1);
}

.sheet--dragging {
  transition: none;
}

.sheet .grip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 1.75rem;
  cursor: grab;

  /* Without this the browser scrolls the page instead of dragging the sheet. */
  touch-action: none;
}

.sheet .grip:focus-visible {
  outline: 2px solid var(--color-primary-strong);
  outline-offset: -4px;
}

.sheet .bar {
  width: 2.5rem;
  height: 0.25rem;
  background: var(--color-border);
  border-radius: 999px;
}

.sheet .content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
