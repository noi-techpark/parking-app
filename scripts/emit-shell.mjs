// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/**
 * Emits dist/index.html, the standalone site deployed to the S3 buckets
 * (parking.opendatahub.com / parking.bz.it). It is a thin shell around the very
 * same bundle that gets pushed to the webcomponent store, so there is only ever
 * one build artefact to reason about.
 *
 * Matomo + cookie consent are injected only when MATOMO=true, matching what
 * nuxt.config.js used to do for the site deployments and deliberately leaving
 * them out of the webcomponent builds.
 */

import { writeFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const MATOMO = process.env.MATOMO === 'true'
const BUNDLE = 'bolzano-parking-app.min.js'

const consentHead = MATOMO
  ? `
    <link
      rel="stylesheet"
      href="https://scripts.opendatahub.com/cookieconsent/opendatahub/cookieconsent.css"
    />`
  : ''

const consentBody = MATOMO
  ? `
    <script type="text/javascript" src="https://scripts.opendatahub.com/cookieconsent/cookieconsent.js"></script>
    <script type="text/javascript" src="https://scripts.opendatahub.com/cookieconsent/cookieconsent-init.js"></script>
    <script type="text/plain" data-cookiecategory="targeting" src="./matomo.js"></script>`
  : ''

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Real-Time Parking</title>
    <meta
      name="description"
      content="Showing real time data and predictions of parking spaces"
    />
    <meta name="format-detection" content="telephone=no" />
    <link rel="icon" type="image/x-icon" href="./favicon.ico" />${consentHead}
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
      }
      bolzano-parking-app {
        display: block;
        width: 100vw;
        height: 100vh;
      }
    </style>
  </head>
  <body>
    <bolzano-parking-app></bolzano-parking-app>
    <script src="./${BUNDLE}"></script>${consentBody}
  </body>
</html>
`

const out = fileURLToPath(new URL('../dist/index.html', import.meta.url))
writeFileSync(out, html)

console.log(`emit-shell: wrote dist/index.html (matomo=${MATOMO})`)
