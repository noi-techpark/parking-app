<template>
  <div class="search-input" :class="{ big: size === 'big' }">
    <div class="ico" @click="showSearchResults">
      <Icon name="search" />
    </div>
    <input
      ref="input"
      v-model="searchVal"
      type="text"
      :placeholder="$t('cmp.searchInput.searchPlaceholder') + '...'"
      @keypress="keypress($event)"
    />
    <div
      class="action clickable"
      :class="{ visible: searchVal }"
      @click="showSearchResults"
    >
      <Icon name="arrow-right" />
    </div>
  </div>
</template>

<script>
export default {
  props: {
    value: {
      type: String,
      default: '',
    },

    size: {
      type: String,
      default: 'default',
      validator(value) {
        return ['default', 'big'].includes(value)
      },
    },
  },

  data() {
    return {
      searchVal: '',
    }
  },

  created() {
    if (this.value) {
      this.searchVal = this.value
    }
  },

  methods: {
    keypress(event) {
      switch (event.keyCode) {
        case 13:
          this.showSearchResults()
          break
      }
    },

    showSearchResults() {
      this.$emit('showSearchResults', this.$refs.input.value)
    },
  },
}
</script>

<style lang="postcss" scoped>
.search-input {
  @apply bg-white rounded-box;

  width: 520px;
  height: 55px;

  & .ico {
    @apply inline-block h-full text-center align-top;

    width: 85px;

    & svg {
      @apply align-top;

      width: 22px;
      height: 22px;
      margin-top: 18px;
      fill: theme(colors.grey);
    }
  }

  & input {
    @apply inline-block text-xl text-black;

    -webkit-appearance: none;
    width: calc(100% - 170px);
    padding-top: 12px;

    &::placeholder {
      @apply text-grey;
    }

    &:focus {
      @apply outline-none;
    }
  }

  & .action {
    @apply inline-block h-full text-center opacity-0 cursor-pointer pointer-events-none align-top;

    width: 85px;
    transition: opacity 0.3s ease, transform 0.3s ease;
    transform: translateX(-10px);

    & svg {
      @apply align-top;

      width: 24px;
      height: 24px;
      margin-top: 16px;
      fill: theme(colors.primary);
    }

    &.visible {
      @apply opacity-100 pointer-events-auto;

      transform: translateX(0);
    }
  }

  &.big {
    width: 640px;
    height: 85px;

    & .ico {
      & svg {
        width: 30px;
        height: 30px;
        margin-top: 26px;
      }
    }

    & input {
      padding-top: 27px;
    }

    & .action {
      & svg {
        width: 26px;
        height: 26px;
        margin-top: 30px;
      }
    }
  }
}

@media only screen and (max-width: 980px) {
  .search-input {
    @apply w-auto;

    &.big {
      @apply w-auto;

      & .ico {
        & svg {
          width: 26px;
          height: 26px;
          margin-top: 28px;
        }
      }
      & input {
        @apply text-lg;
      }
    }
  }
}
</style>
