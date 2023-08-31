// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

import i18nOptions from './plugins/i18n.options'

const matomo = process.env.MATOMO;

let config = {
  ssr: false,

  // Global page headers: https://go.nuxtjs.dev/config-head
  head: {
    title: 'Bolzano Parking App',
    htmlAttrs: {
      lang: 'en',
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'description', name: 'description', content: 'Showing real time data and predictions of parking spaces' },
      { name: 'format-detection', content: 'telephone=no' },
    ],
    link: [
      { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
    ]
  },


  // Global CSS: https://go.nuxtjs.dev/config-css
  css: [],

  // Plugins to run before rendering page: https://go.nuxtjs.dev/config-plugins
  plugins: [
    { src: '@/plugins/vue-notification', ssr: false },
    '@/plugins/notify',
    '~/plugins/errors.js',
  ],

  // Auto import components (https://go.nuxtjs.dev/config-components)
  components: [{ path: '~/components/', pathPrefix: false }],

  // Modules for dev and build (recommended): https://go.nuxtjs.dev/config-modules
  buildModules: [
    // https://go.nuxtjs.dev/eslint
    '@nuxtjs/eslint-module',
    // https://go.nuxtjs.dev/stylelint
    '@nuxtjs/stylelint-module',
    // https://go.nuxtjs.dev/tailwindcss
    '@nuxtjs/tailwindcss',
  ],

  // Modules: https://go.nuxtjs.dev/config-modules
  modules: ['nuxt-i18n', '@nuxtjs/axios', 'nuxt-custom-elements'],

  customElements: {
    entries: [
      {
        name: 'Bolzano Parking App',
        tags: [
          {
            name: 'BolzanoParkingApp',
            path: '@/components/navigation/AppView',
          },
        ],
      },
    ],
  },

  i18n: i18nOptions,

  // Build Configuration: https://go.nuxtjs.dev/config-build
  build: {
    extend: (config) => {
      const svgRule = config.module.rules.find((rule) => rule.test.test('.svg'))

      svgRule.test = /\.(png|jpe?g|gif|webp)$/

      config.module.rules.push({
        test: /\.svg$/,
        oneOf: [
          {
            resourceQuery: /inline/,
            loader: 'file-loader',
            query: {
              name: 'static/image/[name].[hash:8].[ext]',
            },
          },
          {
            loader: 'vue-svg-loader',
            options: {
              // Optional svgo options
              svgo: {
                plugins: [{ removeViewBox: false }],
              },
            },
          },
        ],
      })

      config.module.rules.push({
        test: /\.(png|jpe?g|gif|svg|webp|avif)$/i,
        use: [
          {
            loader: 'url-loader',
            options: {
              esModule: false,
              limit: 1000, // 1kB
              name: '[name].[ext]',
            },
          },
        ],
      })
    },
  },

  router: {
    linkActiveClass: 'active',
    linkExactActiveClass: 'current',
  },

  pageTransition: 'zoom-page',

  telemetry: false,
};

// set env var 'MATOMO = true' to enable matomo for websites
// keep deactivated for webcomponents
if (matomo && matomo === 'true') {
  console.log("MATOMO ENABLED");
  console.log(matomo);
  config.head.link.push({ rel: 'stylesheet', href: 'https://scripts.opendatahub.com/cookieconsent/opendatahub/cookieconsent.css' });
  config.head.script = [];
  config.head.script.push({ body: true, type: 'text/javascript', src: 'https://scripts.opendatahub.com/cookieconsent/cookieconsent.js' });
  config.head.script.push({ body: true, type: 'text/javascript', src: 'https://scripts.opendatahub.com/cookieconsent/cookieconsent-init.js' });
  config.head.script.push({ type: 'text/plain', 'data-cookiecategory': 'targeting', src: './matomo.js' });
}

export default config;
