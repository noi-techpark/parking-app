// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

import js from '@eslint/js'
import vue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**', '.geo-cache/**'] },

  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  prettier,

  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Injected by vite.config.js `define`.
        __ENVIRONMENT__: 'readonly',
        __MATOMO__: 'readonly',
        __STANDALONE__: 'readonly',
      },
    },
    rules: {
      // Single-word component filenames are the norm here (AppView, Modal).
      'vue/multi-word-component-names': 'off',
    },
  },

  {
    files: ['scripts/**/*.mjs', 'vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['test/**/*.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    // config.js deliberately runs in both worlds: the bundle (where Vite has
    // substituted the build-time constants) and plain node (the geo build and
    // the live verification script), where it reads process.env instead.
    files: ['src/lib/config.js'],
    languageOptions: { globals: { process: 'readonly' } },
  },
]
