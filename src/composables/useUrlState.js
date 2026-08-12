// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { getCurrentInstance, onBeforeUnmount, watch } from 'vue'

/**
 * Mirrors filter state into the query string.
 *
 * Modelled on the useUrlParams composable in the CCC frontend — parse on init,
 * re-parse on history navigation, debounce writes, comma-separate arrays — but
 * built on the History API rather than vue-router, because this ships as a
 * custom element rather than inside a routed app.
 *
 * The guiding rule is that the URL should be readable and hand-editable:
 * spelled-out parameter names, plain comma-separated lists, and nothing
 * JSON-encoded. Parameters the component does not own are copied through
 * untouched, so a host page keeps its own state.
 *
 * Only the standalone site calls this at all — see IS_STANDALONE.
 */

const DEFAULT_DEBOUNCE = 300

/**
 * Percent-encoding, minus the characters that are legal in a query value and
 * only make the URL harder to read.
 *
 * `,` separates our lists and `:` appears inside station codes
 * (`urn:parking:skidata:…`); escaping either buys nothing.
 */
function encodeValue(value) {
  return encodeURIComponent(value).replace(/%2C/g, ',').replace(/%3A/g, ':')
}

const asList = (raw) =>
  raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

/**
 * @param fields  { name: { ref, type: 'list' | 'string', to?, from? } }
 *                `to` maps internal values outward, `from` maps them back.
 * @param options { debounceMs }
 */
export function useUrlState(fields, options = {}) {
  const { debounceMs = DEFAULT_DEBOUNCE } = options

  if (typeof window === 'undefined' || !window.history?.replaceState) {
    return { read: () => {}, write: () => {}, stop: () => {} }
  }

  const entries = Object.entries(fields)
  const owned = new Set(entries.map(([name]) => name))
  let timer = null

  function read() {
    const params = new URLSearchParams(window.location.search)

    for (const [name, field] of entries) {
      const raw = params.get(name)
      if (raw === null) {
        field.ref.value = field.type === 'list' ? [] : ''
        continue
      }
      const parsed = field.type === 'list' ? asList(raw) : raw
      field.ref.value = field.from ? field.from(parsed) : parsed
    }
  }

  function write() {
    const current = new URLSearchParams(window.location.search)
    const parts = []

    // Anything that is not ours passes through exactly as it arrived.
    for (const [key, value] of current) {
      if (!owned.has(key)) parts.push(`${encodeValue(key)}=${encodeValue(value)}`)
    }

    for (const [name, field] of entries) {
      const raw = field.to ? field.to(field.ref.value) : field.ref.value
      const value = field.type === 'list' ? (raw ?? []).join(',') : (raw ?? '')
      if (value) parts.push(`${encodeValue(name)}=${encodeValue(value)}`)
    }

    const query = parts.join('&')
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`

    /*
     * Idempotent by comparison rather than by a "currently applying" flag.
     *
     * Reading the URL into state makes the watchers fire, which would write it
     * straight back. A flag cannot suppress only that: Vue coalesces the read's
     * change and any user change into a single watcher call, so the flag would
     * swallow the real edit too. Comparing the result is exact.
     */
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
    if (next === currentUrl) return

    // replaceState, not pushState: dragging a filter should not build up a
    // history stack the back button has to walk out of.
    window.history.replaceState(window.history.state, '', next)
  }

  function scheduleWrite() {
    if (timer) clearTimeout(timer)
    timer = setTimeout(write, debounceMs)
  }

  const stopWatchers = entries.map(([, field]) =>
    watch(field.ref, scheduleWrite, { deep: true })
  )

  window.addEventListener('popstate', read)
  read()

  function stop() {
    if (timer) clearTimeout(timer)
    timer = null
    window.removeEventListener('popstate', read)
    for (const stopWatch of stopWatchers) stopWatch()
  }

  // Only auto-tears-down when used from a component; callable standalone too.
  if (getCurrentInstance()) onBeforeUnmount(stop)

  return { read, write, stop }
}
