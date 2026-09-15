<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { nextTick, computed } from 'vue'
import { useRouter } from 'vue-router'

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
        <span class="text-[11px] font-black uppercase tracking-wider text-sky-300 px-3 mb-1.5 block">
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
                class="flex grow gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-200 focus-visible-app-default hover:bg-white/10 hover:text-white! hover:no-underline! transition-all duration-150 focus-visible:rounded-xl! group"
                :class="{
                  'bg-[#16a34a]! text-white! font-extrabold shadow-sm ring-1 ring-emerald-400/30': isRouteActive(route),
                }"
                :link="route.path.replace(/\/:\w+/, '')"
                exact-active-class="bg-[#16a34a]! w-full text-white!"
                internal
              >
                <CommonLabel
                  class="gap-3 text-sm! text-current! font-bold"
                  size="medium"
                  :prefix-icon="route.meta.icon"
                >
                  {{ $t(route.meta.title) }}
                </CommonLabel>
              </CommonLink>
            </li>
          </ul>
        </nav>
      </template>
    </CommonSectionCollapse>
  </div>
</template>

<style scoped>
:deep(svg) {
  width: 1.25rem !important;
  height: 1.25rem !important;
  color: #38bdf8 !important;
  fill: currentColor !important;
  transition: all 150ms ease !important;
}
:deep(a:hover svg) {
  color: #ffffff !important;
  fill: #ffffff !important;
}
:deep([class*="bg-[#16a34a]"] svg),
:deep(.bg-\[\#16a34a\] svg) {
  color: #ffffff !important;
  fill: #ffffff !important;
}
</style>
