<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useSessionStore } from '#shared/stores/session.ts'
import emitter from '#shared/utils/emitter.ts'

import OnlineNotification from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification.vue'
import QuickSearchInput from '#desktop/components/Search/QuickSearch/QuickSearchInput/QuickSearchInput.vue'

interface Props {
  collapsed?: boolean
}

defineProps<Props>()

const router = useRouter()

const searchValue = defineModel<string>('search', {
  required: true,
})

const isSearchActive = defineModel<boolean>('search-active', {
  default: false,
})

whenever(
  () => !isSearchActive.value,
  () => {
    emitter.emit('close-popover')
  },
)

const { hasPermission } = useSessionStore()

const isTicketAgent = computed(() => hasPermission('ticket.agent') ?? false)
</script>

<template>
  <header class="flex flex-col gap-3 rounded-t-lg">
    <!-- TOP ROW: BRAND LOGO & TITLE -->
    <div
      v-if="!collapsed"
      class="flex items-center gap-3 px-0.5 cursor-pointer group select-none"
      role="button"
      tabindex="0"
      @click="router.push('/')"
      @keydown.enter="router.push('/')"
    >
      <!-- Crisp White Badge for Brand Logo (Zero Shady Look) -->
      <div
        class="h-11 w-11 rounded-2xl bg-white p-1.5 shadow-md ring-2 ring-white/40 flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105"
      >
        <img
          src="/assets/images/branding/student_hub_logo.png"
          alt="Student Hub"
          class="h-full w-full object-contain"
        />
      </div>

      <!-- Title & Admin Badge -->
      <div class="flex flex-col min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-base font-black text-white tracking-tight leading-none truncate group-hover:text-sky-200 transition-colors">
            Student Hub
          </span>
          <span class="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-sky-500/25 text-sky-300 border border-sky-400/40 shadow-2xs">
            Admin
          </span>
        </div>
        <span class="text-[10px] font-semibold text-[#93b5d4] tracking-wider uppercase truncate mt-0.5">
          LSST · FSB · UKBC
        </span>
      </div>

      <!-- Online / Notification bell -->
      <component
        :is="isTicketAgent ? OnlineNotification : 'div'"
        class="ltr:ml-auto rtl:mr-auto shrink-0 flex items-center justify-center p-1.5 rounded-xl hover:bg-white/10 transition-colors"
      >
        <svg class="h-5 w-5 text-sky-300 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </component>
    </div>

    <!-- Collapsed View Logo -->
    <div v-else class="flex flex-col items-center gap-2 py-1">
      <div
        class="h-10 w-10 rounded-2xl bg-white p-1.5 shadow-md ring-2 ring-white/30 flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
        @click="router.push('/')"
      >
        <img
          src="/assets/images/branding/student_hub_logo.png"
          alt="Student Hub"
          class="h-full w-full object-contain"
        />
      </div>

      <component
        :is="isTicketAgent ? OnlineNotification : 'div'"
        class="flex items-center justify-center p-1 rounded-lg hover:bg-white/10 transition-colors"
      >
        <svg class="h-4 w-4 text-sky-300 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </component>
    </div>

    <!-- FULL WIDTH SEARCH INPUT -->
    <div v-if="!collapsed" class="w-full">
      <QuickSearchInput
        v-model="searchValue"
        v-model:search-active="isSearchActive"
        class="w-full"
      />
    </div>
  </header>
</template>

<style scoped>
:deep([role="searchbox"]),
:deep(input[type="text"]) {
  background-color: #162d4a !important;
  color: #f8fafc !important;
  font-size: 0.875rem !important;
  font-weight: 500 !important;
}
:deep([role="searchbox"]::placeholder),
:deep(input[type="text"]::placeholder) {
  color: #94a3b8 !important;
}
:deep(.rounded-lg) {
  background-color: #162d4a !important;
  border: 1px solid #2d4f7c !important;
  border-radius: 0.75rem !important;
  transition: all 150ms ease !important;
}
:deep(.rounded-lg:focus-within) {
  border-color: #38bdf8 !important;
  box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2) !important;
}
:deep(.inline-flex.grow.items-center svg) {
  fill: #38bdf8 !important;
  color: #38bdf8 !important;
}
</style>
