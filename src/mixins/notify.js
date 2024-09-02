// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export default {
  methods: {
    notifyGenericError() {
      this.notifyError(this.$t('common.genericError'))
    },

    notifySavedChanges() {
      this.notifySuccess(this.$t('common.settingsSaved'))
    },

    notifyError(message) {
      this.$notify({
        group: 'main',
        text: message,
        duration: 5000,
        type: 'error',
      })
    },

    notifySuccess(message) {
      this.$notify({
        group: 'main',
        text: message,
        duration: 3000,
        type: 'success',
      })
    },
  },
}
