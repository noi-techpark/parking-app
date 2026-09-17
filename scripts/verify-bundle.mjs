// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/**
 * Executes the built bundle the way the webcomponent store does.
 *
 * Every other check in this repo runs the *source* through Vite's transform.
 * That misses anything the library build itself introduces — notably that Vite
 * leaves `process.env.NODE_ENV` unsubstituted in lib mode, which threw
 * "process is not defined" at module scope and stopped the element registering
 * at all. Dev worked, tests passed, the artefact was dead.
 *
 * So this loads dist/bolzano-parking-app.min.js as a plain classic script, in a
 * bare DOM with no bundler and no Node globals, and checks it actually runs.
 *
 *   yarn verify:bundle
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'

import { JSDOM } from 'jsdom'

const BUNDLE = fileURLToPath(
  new URL('../dist/bolzano-parking-app.min.js', import.meta.url)
)
const TAG = 'bolzano-parking-app'

const fail = (message) => {
  console.error(`[bundle] FAIL: ${message}`)
  process.exitCode = 1
}
const pass = (message) => console.log(`[bundle] ok: ${message}`)

const code = await readFile(BUNDLE, 'utf8')

// --- static checks --------------------------------------------------------

const nodeGlobals = code.match(/process\.env\.[A-Za-z_]+/g) ?? []
if (nodeGlobals.length) {
  fail(
    `${nodeGlobals.length} unsubstituted Node globals, e.g. ${[...new Set(nodeGlobals)]
      .slice(0, 3)
      .join(', ')}`
  )
} else {
  pass('no unsubstituted process.env references')
}

// --- run it ---------------------------------------------------------------

const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  url: 'https://parking.example/',
})
const { window } = dom

// The browser has these; jsdom does not. Anything *else* missing is a real bug.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
window.HTMLCanvasElement.prototype.getContext = () => null
// The bundle must not need these; they are here so a network call cannot be
// what fails, keeping the check about module evaluation.
window.fetch = async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })

const errors = []
window.addEventListener('error', (event) => errors.push(event.error ?? event.message))

try {
  window.eval(code)
  pass('bundle evaluates without throwing')
} catch (error) {
  fail(`bundle threw on evaluation: ${error.message}`)
  process.exit(1)
}

if (!window.customElements.get(TAG)) {
  fail(`<${TAG}> was not registered`)
} else {
  pass(`<${TAG}> registered`)
}

// --- mount it -------------------------------------------------------------

const element = window.document.createElement(TAG)
window.document.body.appendChild(element)
await new Promise((resolve) => setTimeout(resolve, 300))

if (!element.shadowRoot) {
  fail('element did not attach a shadow root')
} else {
  pass('element attached a shadow root')

  const styles = [...element.shadowRoot.querySelectorAll('style')]
    .map((node) => node.textContent)
    .join('')
  if (!styles.includes('--color-')) {
    fail('design tokens were not injected into the shadow root')
  } else {
    pass('design tokens present in the shadow root')
  }

  if (!element.shadowRoot.querySelector('.app')) {
    fail('element rendered nothing')
  } else {
    pass('element rendered its root markup')
  }
}

if (errors.length) {
  fail(`${errors.length} runtime error(s): ${errors[0]}`)
} else {
  pass('no uncaught runtime errors')
}

if (process.exitCode) {
  console.error('\n[bundle] the built artefact is broken — do not publish it')
} else {
  console.log('\n[bundle] artefact looks publishable')
}

// The app schedules polling timers and animation frames on mount, which keep
// the event loop alive forever. Tear the window down and exit deliberately.
element.remove()
window.close()
process.exit(process.exitCode ?? 0)
