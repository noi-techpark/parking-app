// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import Vue from 'vue'
import notify from '~/mixins/notify'

if (!Vue.__notify__) {
  Vue.__notify__ = true
  Vue.mixin(notify)
}
