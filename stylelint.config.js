// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

const shared = {
  rules: {
    // Tailwind v4 directives.
    'at-rule-no-unknown': [
      true,
      { ignoreAtRules: ['theme', 'source', 'utility', 'variant', 'apply'] },
    ],
    // `:host` is how the component styles its own box inside the shadow root.
    'selector-pseudo-class-no-unknown': [
      true,
      { ignorePseudoClasses: ['host', 'deep'] },
    ],
    'custom-property-empty-line-before': null,
    'comment-empty-line-before': null,
    // BEM: block, optional __element, optional --modifier, all kebab-case.
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Expected class selector to be kebab-case BEM' },
    ],
    // Tailwind v4 requires the bare `@import 'tailwindcss'` form.
    'import-notation': null,
    // Keeps the token table uniform: every colour stays six digits.
    'color-hex-length': null,
  },
}

export default {
  extends: ['stylelint-config-standard'],
  ...shared,
  overrides: [
    {
      // Only the <style> blocks of a single-file component are CSS; without
      // this stylelint tries to parse <script setup> as a stylesheet.
      files: ['**/*.vue'],
      customSyntax: 'postcss-html',
      ...shared,
    },
  ],
}
