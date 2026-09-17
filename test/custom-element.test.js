// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeAll } from 'vitest'
import { TAG_NAME } from '@/main.js'

const nextFrame = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('bolzano-parking-app custom element', () => {
  beforeAll(() => {
    document.body.innerHTML = ''
  })

  it('registers the tag name the webcomponent store expects', () => {
    expect(TAG_NAME).toBe('bolzano-parking-app')
    expect(customElements.get(TAG_NAME)).toBeTypeOf('function')
  })

  it('upgrades, attaches a shadow root and renders', async () => {
    const el = document.createElement(TAG_NAME)
    document.body.appendChild(el)
    await nextFrame()

    expect(el.shadowRoot).not.toBeNull()
    expect(el.shadowRoot.querySelector('.app')).not.toBeNull()
  })

  it('injects the design tokens and OpenLayers styles into the shadow root', async () => {
    const el = document.createElement(TAG_NAME)
    document.body.appendChild(el)
    await nextFrame()

    const css = [...el.shadowRoot.querySelectorAll('style')]
      .map((s) => s.textContent)
      .join('\n')

    // Tailwind emits theme variables on `:root,:host`, which is what makes the
    // tokens reachable from inside the shadow root at all.
    expect(css).toContain('--color-avail-high-strong')
    expect(css).toContain('--color-primary')
    expect(css).toContain('--ol-background-color')
  })

  it('renders styles of nested components into the same shadow root', async () => {
    const el = document.createElement(TAG_NAME)
    document.body.appendChild(el)
    await nextFrame()

    expect(el.shadowRoot.querySelector('.brand')).not.toBeNull()

    const css = [...el.shadowRoot.querySelectorAll('style')]
      .map((s) => s.textContent)
      .join('\n')
    // AppBrand.vue's own <style> block, proving child SFC styles are collected
    // and not silently dropped.
    expect(css).toContain('.brand .mark')
  })
})
