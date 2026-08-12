<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref, computed } from 'vue'

import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'
import { useTransitionConfig } from '#desktop/composables/useTransitionConfig.ts'

import LayoutPublicPageBoxActions from './LayoutPublicPageBoxActions.vue'

import type { BoxSizes } from '../types'

export interface Props {
  title?: string
  showLogo?: boolean
  boxSize?: BoxSizes
  hideFooter?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  boxSize: 'medium',
})

const boxSizeMap: Record<BoxSizes, string> = {
  small: 'max-w-md',
  medium: 'max-w-lg',
  large: 'max-w-2xl',
}

const boxSizeClass = computed(() => {
  return boxSizeMap[props.boxSize]
})

const hoverPoweredByLogo = ref(false)

const { transitions } = useTransitionConfig()
</script>

<template>
  <div
    class="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0F1729] font-sans text-white p-4 sm:p-6 select-none"
  >
    <!-- Background gradients -->
    <div class="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
      <div class="absolute -top-1/2 -right-1/4 w-[800px] h-[800px] bg-blue-500/20 rounded-full blur-[120px]"></div>
      <div class="absolute -bottom-1/2 -left-1/4 w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[100px]"></div>
    </div>

    <div :class="boxSizeClass" class="relative z-10 m-auto w-full flex flex-col items-center justify-center">
      <main
        class="flex flex-col gap-3.5 rounded-2xl bg-white p-6 sm:p-9 text-slate-900 border border-slate-100 shadow-2xl shadow-black/50 transition-all duration-300 w-full relative overflow-hidden"
      >
        <!-- TOP ACCENT LINE -->
        <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent"></div>

        <div v-if="showLogo" class="flex justify-center mb-3">
          <img
            :src="studentHubLogo"
            class="w-28 h-28 sm:w-32 sm:h-32 object-contain mx-auto transition-transform hover:scale-105 duration-200"
            alt="Student Hub"
          />
        </div>
        <h1 v-if="title" class="mb-4 text-center text-2xl font-bold tracking-tight text-slate-900">
          {{ $t(title) }}
        </h1>
        <slot />

        <LayoutPublicPageBoxActions v-if="$slots.boxActions">
          <slot name="boxActions" />
        </LayoutPublicPageBoxActions>
      </main>

      <section
        v-if="$slots.bottomContent"
        :aria-label="$t('Additional information and links')"
        class="flex w-full flex-col items-center justify-center space-y-3 py-4 text-xs"
      >
        <slot name="bottomContent" />
      </section>
    </div>
  </div>
</template>
