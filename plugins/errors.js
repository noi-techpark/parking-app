export default function ({ app }) {
  // NOTE: since vue-layers throws and error each time it gets unmounted, the error screen has been disabled
  app.nuxt.error = () => {}
}
