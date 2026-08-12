// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// Build-time environment switches. The CI sets ENVIRONMENT=test for the test
// deployments and leaves it unset for production; MATOMO=true and
// STANDALONE=true only for the standalone sites, never for the webcomponent.
const ENVIRONMENT = process.env.ENVIRONMENT ?? ''
const MATOMO = process.env.MATOMO === 'true'

const src = fileURLToPath(new URL('./src', import.meta.url))

export default defineConfig(({ command }) => ({
  plugins: [
    // customElement: true compiles every SFC <style> into a string on the
    // component's `styles` option, so Vue can inject it into the shadow root
    // instead of emitting a stylesheet the webcomponent host would never load.
    vue({ customElement: true }),
    tailwindcss(),
  ],

  resolve: {
    alias: { '@': src, '~': src },
  },

  define: {
    __ENVIRONMENT__: JSON.stringify(ENVIRONMENT),
    __MATOMO__: JSON.stringify(MATOMO),
    /*
     * Whether this build is the standalone site rather than the distributable
     * webcomponent. It governs URL mirroring, which must always be on for the
     * site (a parking view should be linkable) and never on when embedded,
     * where rewriting the host page's URL would be an intrusion.
     *
     * A build-time constant, not an attribute: an integrator embedding the
     * component should not be able to turn it on. `vite serve` is the
     * standalone app, so developing against it behaves like production.
     */
    __STANDALONE__: JSON.stringify(
      command === 'serve' || process.env.STANDALONE === 'true'
    ),
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    // Everything has to live in the single file listed in wcs-manifest.json,
    // so inline images and fonts rather than emitting sibling assets.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    lib: {
      entry: fileURLToPath(new URL('./src/main.js', import.meta.url)),
      name: 'BolzanoParkingApp',
      formats: ['iife'],
      fileName: () => 'bolzano-parking-app.min.js',
    },
    rollupOptions: {
      output: {
        // IIFE cannot code-split; dynamic imports stay lazy at execution time
        // but are bundled into the one file.
        inlineDynamicImports: true,
      },
    },
  },

  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.js'],
    setupFiles: ['test/setup.js'],
    // Vitest stubs CSS imports to empty strings by default. The shadow-DOM
    // style injection is exactly what these tests need to assert, so process it.
    css: true,
  },
}))
