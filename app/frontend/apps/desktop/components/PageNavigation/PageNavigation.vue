<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'

import CommonIcon from '#shared/components/CommonIcon/CommonIcon.vue'
import { useSessionStore } from '#shared/stores/session.ts'
import emitter from '#shared/utils/emitter.ts'

import CommonSectionCollapse from '#desktop/components/CommonSectionCollapse/CommonSectionCollapse.vue'
import { sortedFirstLevelRoutes } from '#desktop/components/PageNavigation/firstLevelRoutes.ts'

import CommonButton from '../CommonButton/CommonButton.vue'
import { SidebarName } from '../layout/types.ts'
import { useSidebarDisplay } from '../layout/useSidebarDisplay.ts'

interface Props {
  collapsed?: boolean
}

defineProps<Props>()

const router = useRouter()

const { hasPermission } = useSessionStore()

const { toggleSidebar } = useSidebarDisplay(SidebarName.Primary)

const openSearch = () => {
  toggleSidebar(false)
  nextTick(() => emitter.emit('focus-quick-search-field'))
}

const permittedRoutes = computed(() =>
  sortedFirstLevelRoutes.filter((route) => hasPermission(route.meta.requiredPermission)),
)

const isRouteActive = (route: any) => {
  const current = router.currentRoute.value
  if (current.name === route.name) return true
  const cleanPath = route.path.replace(/\/:\w+/, '')
  if (cleanPath !== '/' && current.path.startsWith(cleanPath)) return true
  return false
}
</script>

<template>
  <div>
    <CommonSectionCollapse id="page-navigation" :no-header="collapsed">
      <template #title>
        <span class="text-[11px] font-bold uppercase tracking-wider text-slate-400/80 px-3.5 mb-1.5 block select-none">
          {{ __('Navigation') }}
        </span>
      </template>
      <template #default="{ headerId }">
        <nav :aria-labelledby="headerId">
          <ul class="flex basis-full flex-col" :class="{ 'gap-1': collapsed }">
            <li class="flex justify-center">
              <CommonButton
                v-if="collapsed"
                v-tooltip="$t('Open quick search')"
                class="shrink-0 text-slate-300 hover:outline-blue-900"
                size="large"
                variant="neutral"
                icon="search"
                @click="openSearch"
              />
            </li>
            <li
              v-for="route in permittedRoutes"
              :key="route.path"
              class="flex justify-center"
              :class="{ 'not-last:mb-1.5': !collapsed }"
            >
              <CommonButton
                v-if="collapsed"
                class="shrink-0 text-slate-300 focus-visible-app-default hover:outline-blue-900"
                size="large"
                variant="neutral"
                :icon="route.meta.icon"
                @click="router.push(route.path.replace(/:\w+/, ''))"
              />
              <CommonLink
                v-else
                class="flex grow items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:text-white! hover:no-underline! transition-all duration-150 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/50 group"
                :class="{
                  'active-nav-item bg-white/15! text-white! font-bold ring-1 ring-white/25 shadow-xs': isRouteActive(route),
                }"
                :link="route.path.replace(/\/:\w+/, '')"
                exact-active-class="active-nav-item bg-white/15! text-white! font-bold ring-1 ring-white/25 shadow-xs"
                internal
              >
                <div
                  class="flex h-7.5 w-7.5 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-slate-300 transition-all duration-150 group-hover:bg-white/10 group-hover:border-white/20 group-hover:text-sky-300"
                  :class="{
                    'bg-sky-500/25! border-sky-400/40! text-sky-300! shadow-xs': isRouteActive(route),
                  }"
                >
                  <CommonIcon
                    :name="route.meta.icon"
                    size="small"
                    class="transition-transform duration-150 group-hover:scale-110"
                    decorative
                  />
                </div>
                <span class="truncate text-sm font-semibold tracking-tight text-current">
                  {{ $t(route.meta.title) }}
                </span>
              </CommonLink>
            </li>
          </ul>
        </nav>
      </template>
    </CommonSectionCollapse>
  </div>
</template>

<style scoped>
:deep(a) {
  outline: none !important;
  text-decoration: none !important;
}
:deep(a:focus),
:deep(a:focus-visible) {
  outline: none !important;
}
</style>
