// SPDX-FileCopyrightText: NOI Techpark <digital@noi.bz.it>
//
// SPDX-License-Identifier: CC0-1.0

/*
 ** TailwindCSS Configuration File
 **
 ** Docs: https://tailwindcss.com/docs/configuration
 ** Default: https://github.com/tailwindcss/tailwindcss/blob/master/stubs/defaultConfig.stub.js
 */
module.exports = {
  theme: {
    fontFamily: {
      sans: ['Hind', 'sans-serif'],
    },
    extend: {
      colors: {
        primary: '#009CDD',
        'primary-hover': '#07AFE2',
        'primary-text': '#76c9e2',
        secondary: '#f8f8f8',
        'secondary-hover': '#fAfAfA',
        'light-black': '#343434',
        green: '#8BE277',
        orange: '#E2CD77',
        red: '#E28377',
        'green-hover': '#A2EE90',
        'orange-hover': '#EEE390',
        'red-hover': '#EEA290',
        'dark-green': '#78B76A',
        'dark-orange': '#B7AB6A',
        'dark-red': '#B76D6A',
        grey: '#888888',
        input: '#F2F2F2',
        'input-focus': '#F0F0F0',
        'light-red': '#fff1f1',
        'light-red-focus': '#fde9e9',
        placeholder: '#eeeeee',
      },
      borderRadius: {
        button: '10px',
        box: '20px',
      },
    },
  },
  variants: {},
  plugins: [],
}
