// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import { defineCustomElement } from 'vue'
import { createPinia } from 'pinia'
import { createI18n, I18nInjectionKey } from 'vue-i18n'

import AppView from '@/components/AppView.vue'
import { DEFAULT_LOCALE, detectLocale } from '@/lib/locale.js'
import eng from '@/locales/eng.json'
import ita from '@/locales/ita.json'
import deu from '@/locales/deu.json'

// Imported as strings rather than stylesheets: the bundle is loaded as a plain
// <script> by the webcomponent store, so there is no sibling CSS file to link.
// Vue injects whatever is in `styles` into the element's shadow root.
import appCss from '@/assets/css/app.css?inline'
import olCss from 'ol/ol.css?inline'

AppView.styles = [appCss, olCss, ...(AppView.styles ?? [])]

export const ParkingAppElement = defineCustomElement(AppView, {
  shadowRoot: true,

  // Called once per element instance, so two tags on the same page get
  // independent stores and locales rather than sharing global state.
  configureApp(app) {
    app.use(createPinia())

    const i18n = createI18n({
      legacy: false,
      globalInjection: true,
      // The element may also carry a `language` attribute; AppView applies it
      // once mounted, because attributes are not readable from here.
      locale: detectLocale(),
      fallbackLocale: DEFAULT_LOCALE,
      messages: { eng, ita, deu },
    })
    app.use(i18n)
    // Inside a custom element vue-i18n resolves `useI18n()` through the public
    // I18nInjectionKey rather than the app's private symbol, so `app.use` alone
    // leaves every setup() throwing NOT_INSTALLED_WITH_PROVIDE.
    app.provide(I18nInjectionKey, i18n)
  },
})

export const TAG_NAME = 'bolzano-parking-app'

if (!customElements.get(TAG_NAME)) {
  customElements.define(TAG_NAME, ParkingAppElement)
}
