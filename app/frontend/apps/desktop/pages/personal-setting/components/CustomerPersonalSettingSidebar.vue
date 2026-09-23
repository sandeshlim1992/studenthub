<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useSessionStore } from '#shared/stores/session.ts'

import { personalSettingItems } from '../views/PersonalSetting/plugins/index.ts'

const router = useRouter()
const route = useRoute()
const session = useSessionStore()

const isItemActive = (entry: any) => {
  if (entry.route?.name && route.name === entry.route.name) return true
  const path = typeof entry.route === 'string' ? entry.route : entry.route?.path || ''
  if (path && (route.path.endsWith(`/${path}`) || route.path.endsWith(path))) return true
  if (entry.id && route.path.includes(entry.id)) return true
  return false
}

const navigateTo = (entry: any) => {
  if (entry.route?.name) {
    router.push({ name: entry.route.name })
  } else if (entry.route?.path) {
    router.push(`/personal-setting/${entry.route.path}`)
  } else if (typeof entry.route === 'string') {
    router.push(entry.route)
  }
}

const permittedItems = computed(() => {
  const result: Record<string, any[]> = {}
  Object.keys(personalSettingItems).forEach((category) => {
    const items = personalSettingItems[category].filter((entry) => {
      if (
        typeof entry.route === 'object' &&
        entry.route.meta?.requiredPermission &&
        !session.hasPermission(entry.route.meta.requiredPermission)
      ) {
        return false
      }
      if (typeof entry.show === 'function') return entry.show(session.user)
      return true
    })
    if (items.length > 0) {
      result[category] = items
    }
  })
  return result
})
</script>

<template>
  <aside
    class="w-full md:w-72 lg:w-80 h-full bg-white border-b md:border-b-0 md:border-r border-slate-200/90 flex flex-col shrink-0 select-none shadow-xs transition-all duration-200"
  >
    <!-- Top Action Bar (Back to Dashboard) -->
    <div class="p-4 border-b border-slate-100 flex flex-col gap-3 bg-slate-50/80 shrink-0">
      <button
        type="button"
        class="flex items-center gap-2.5 text-sm font-bold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 border border-slate-200/90 px-4 py-2.5 rounded-xl transition-all duration-150 cursor-pointer shadow-2xs group active:scale-98"
        @click="router.push('/')"
      >
        <svg
          class="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:-translate-x-1 transition-all"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2.5"
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        <span>{{ $t('Back to Dashboard') }}</span>
      </button>
    </div>

    <!-- Header Section -->
    <div class="px-5 py-4 border-b border-slate-100 bg-white shrink-0">
      <div class="flex items-center gap-2.5">
        <div
          class="w-8 h-8 rounded-xl bg-emerald-50 text-[#15803d] flex items-center justify-center border border-emerald-200/80 shadow-2xs"
        >
          <svg class="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <div>
          <h2 class="text-sm font-extrabold text-slate-900 leading-tight">
            {{ $t('Account Settings') }}
          </h2>
          <p class="text-xs text-slate-400 leading-tight mt-0.5">
            {{ $t('Personal preferences') }}
          </p>
        </div>
      </div>
    </div>

    <!-- Navigation Menu Items -->
    <div class="flex-1 overflow-y-auto px-3.5 py-4 space-y-5">
      <div v-for="(items, category) in permittedItems" :key="category" class="space-y-1.5">
        <div class="px-2.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {{ $t(category) }}
        </div>

        <button
          v-for="entry in items"
          :key="entry.id || entry.label"
          type="button"
          class="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer text-left relative"
          :class="
            isItemActive(entry)
              ? 'bg-emerald-50 text-emerald-800 font-bold ring-1 ring-emerald-500/20 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-medium'
          "
          @click="navigateTo(entry)"
        >
          <!-- Microsoft 365 Logo Icon -->
          <div
            v-if="entry.id === 'password' || entry.route?.name === 'PersonalSettingPassword'"
            class="w-4.5 h-4.5 shrink-0 flex items-center justify-center"
          >
            <svg class="w-4 h-4" viewBox="0 0 21 21" fill="none">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
          </div>

          <!-- Avatar Icon -->
          <svg
            v-else-if="entry.id === 'avatar' || entry.route?.name === 'PersonalSettingAvatar'"
            class="w-4.5 h-4.5 shrink-0"
            :class="isItemActive(entry) ? 'text-[#16a34a]' : 'text-slate-400'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>

          <!-- Language / Locale Icon -->
          <svg
            v-else-if="entry.id === 'locale' || entry.route?.name === 'PersonalSettingLocale'"
            class="w-4.5 h-4.5 shrink-0"
            :class="isItemActive(entry) ? 'text-[#16a34a]' : 'text-slate-400'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
            />
          </svg>

          <!-- Fallback Security / Device Icon -->
          <svg
            v-else
            class="w-4.5 h-4.5 shrink-0"
            :class="isItemActive(entry) ? 'text-[#16a34a]' : 'text-slate-400'"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>

          <span class="truncate">
            {{
              (entry.id === 'password' || entry.route?.name === 'PersonalSettingPassword')
                ? $t('Microsoft 365 SSO')
                : $t(entry.label)
            }}
          </span>

          <span
            v-if="entry.id === 'password' || entry.route?.name === 'PersonalSettingPassword'"
            class="ltr:ml-auto rtl:mr-auto text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-100/80 text-emerald-800 border border-emerald-300/40"
          >
            SSO
          </span>
        </button>
      </div>
    </div>
  </aside>
</template>
