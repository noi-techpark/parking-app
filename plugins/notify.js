import Vue from 'vue'
import notify from '~/mixins/notify'

if (!Vue.__notify__) {
  Vue.__notify__ = true
  Vue.mixin(notify)
}
