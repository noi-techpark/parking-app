// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export default function ({ app }) {
  // NOTE: since vue-layers throws and error each time it gets unmounted, the error screen has been disabled
  app.nuxt.error = () => {}
}
