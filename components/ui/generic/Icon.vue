<script>
/**
 * @see https://webpack.js.org/api/module-methods/#requirecontext
 * @see https://webpack.js.org/concepts/loaders/#inline
 */

const _require = {
  icons: require.context('!vue-svg-loader!~/assets/icon/', false, /\.svg$/),
}

export default {
  functional: true,
  props: {
    name: {
      type: String,
      required: true,
    },
  },

  render(h, context) {
    if (context.props.name) {
      const contextRequire = _require.icons
      try {
        const _module = contextRequire(`./${context.props.name}.svg`)
        return _module.render(h, context)
      } catch (_) {
        // eslint-disable-next-line no-console
        console.warn(
          'Icon not found:' + context.props.type + ' > ' + context.props.name
        )
        const _module = _require.icons(`./broken-image.svg`)
        return _module.render(h, context)
      }
    }
    return h()
  },
}
</script>
