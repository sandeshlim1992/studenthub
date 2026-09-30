<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { type MaybeElementRef, useCurrentElement, type VueInstance } from '@vueuse/core'
import { delay } from 'lodash-es'
import { computed, onBeforeMount, ref, toRef, useTemplateRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useReducedMotion } from '#shared/composables/useReducedMotion.ts'
import { useTrapTab } from '#shared/composables/useTrapTab.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import emitter from '#shared/utils/emitter.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import CustomerHeader from '#desktop/components/Customer/CustomerHeader.vue'
import CustomerSidebar from '#desktop/components/Customer/CustomerSidebar.vue'
import LeftSidebarFooterMenu from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarFooterMenu.vue'
import LeftSidebarHeader from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader.vue'
import LayoutSidebar from '#desktop/components/layout/LayoutSidebar.vue'
import { numberOfPermanentItems } from '#desktop/components/PageNavigation/firstLevelRoutes.ts'
import PageNavigation from '#desktop/components/PageNavigation/PageNavigation.vue'
import QuickSearch from '#desktop/components/Search/QuickSearch/QuickSearch.vue'
import UserTaskbarTabs from '#desktop/components/UserTaskbarTabs/UserTaskbarTabs.vue'
import { useAppBreakpoints } from '#desktop/composables/responsiveness/useAppBreakpoints.ts'
import { useResizeGridColumns } from '#desktop/composables/useResizeGridColumns.ts'

import { SidebarName } from './types.ts'
import { useSidebarDisplay } from './useSidebarDisplay.ts'

const config = toRef(useApplicationStore(), 'config')

const noTransition = ref(false)

const layoutSidebarInstance = useTemplateRef('layout-sidebar')

const isQuickSearchActive = ref(false)
const quickSearchValue = ref('')

const { deactivateTabTrap, activateTabTrap } = useTrapTab(
  useCurrentElement(layoutSidebarInstance as MaybeElementRef<VueInstance> | undefined),
  true,
)

watch(isQuickSearchActive, (isActive) => (isActive ? activateTabTrap() : deactivateTabTrap()))

const { isSmallScreen, isSmallestScreen } = useAppBreakpoints()

const { toggleSidebar: togglePrimaryNavSidebar } = useSidebarDisplay(SidebarName.Primary)

const { isSidebarCollapsed: isContentSidebarCollapsed } = useSidebarDisplay(
  SidebarName.TicketContent,
)

const {
  currentSidebarWidth,
  maxSidebarWidth,
  minSidebarWidth,
  gridColumns,
  resizeSidebar,
  resetSidebarWidth,
} = useResizeGridColumns(SidebarName.Primary)

const emitSidebarEvent = (wait = 100) => {
  delay(() => {
    emitter.emit('primary-sidebar-transition')
  }, wait)
}

const onResize = (width: number) => {
  resizeSidebar(width)
  emitSidebarEvent(0)
}

const onResetWidth = () => {
  resetSidebarWidth()
  emitSidebarEvent()
}

onBeforeMount(() => {
  // On the smallest screen (<768px) the primary nav is collapsed by default.
  if (isSmallestScreen.value) togglePrimaryNavSidebar(true, { storage: 'session' })

  // When the content sidebar expands on a small screen, collapse the primary nav.
  watch(isContentSidebarCollapsed, (isCollapsed) => {
    if (!isSmallScreen.value || isCollapsed) return

    togglePrimaryNavSidebar(true, { storage: 'session' })
  })

  watch(isSmallestScreen, (isSmallest) => {
    if (!isSmallest) return

    togglePrimaryNavSidebar(true, { storage: 'session' })
  })
})

const { hasReducedMotion } = useReducedMotion()

const user = toRef(useSessionStore(), 'user')
const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

const route = useRoute()

const showCustomerSidebar = computed(() => {
  const { name: routeName, path } = route
  if (routeName === 'TicketOverview' || path === '/' || path.startsWith('/tickets/view')) {
    return false
  }
  if (
    routeName === 'TicketDetailView' ||
    routeName === 'TicketCreate' ||
    path.startsWith('/tickets/') ||
    path.startsWith('/ticket/')
  ) {
    return true
  }
  return false
})
</script>

<template>
  <!-- CUSTOMER REDESIGNED PORTAL WRAPPER -->
  <div v-if="isCustomer" class="flex flex-col h-full w-full bg-[#f8fafc] overflow-hidden">
    <!-- Persistent Customer Top Bar with Brand Logo & Profile Dropdown -->
    <CustomerHeader />

    <!-- Main Customer Body -->
    <div class="flex flex-1 min-h-0 overflow-hidden relative">
      <!-- Left Sidebar with Recent Tickets (rendered on ticket detail / ticket create views) -->
      <CustomerSidebar v-if="showCustomerSidebar" />

      <!-- Center Content Area -->
      <div id="main-content" class="flex-1 min-w-0 h-full overflow-y-auto relative">
        <RouterView #default="{ Component, route: currentRoute }">
          <KeepAlive :exclude="['ErrorTab']" :max="config.ui_task_mananger_max_task_count">
            <component
              :is="Component"
              v-if="!currentRoute.meta.permanentItem"
              :key="currentRoute.meta.pageKey || currentRoute.path"
            />
          </KeepAlive>
          <KeepAlive :max="numberOfPermanentItems">
            <component
              :is="Component"
              v-if="currentRoute.meta.permanentItem"
              :key="currentRoute.meta.pageKey || currentRoute.path"
            />
          </KeepAlive>
        </RouterView>
      </div>
    </div>
  </div>

  <!-- AGENT & ADMIN INTERFACE (UNTOUCHED) -->
  <div
    v-else
    :style="{
      '--grid-columns': gridColumns,
    }"
    :class="{ 'transition-none': noTransition || hasReducedMotion }"
    class="grid h-full max-h-full grid-cols-(--grid-columns) overflow-y-clip duration-100 print:h-auto print:max-h-none print:grid-cols-1 print:overflow-visible"
  >
    <LayoutSidebar
      v-if="!isCustomer"
      id="primary-sidebar"
      ref="layout-sidebar"
      :name="SidebarName.Primary"
      :aria-label="$t('Main sidebar')"
      :current-width="currentSidebarWidth"
      :max-width="maxSidebarWidth"
      :min-width="minSidebarWidth"
      :classes="{
        collapseButton: 'z-51',
        resizeLine: 'z-51',
      }"
      :collapsible="!isQuickSearchActive"
      resizable
      no-scroll
      no-padding
      @collapse="emitSidebarEvent"
      @expand="emitSidebarEvent"
      @resize-horizontal="onResize"
      @resize-horizontal-start="noTransition = true"
      @resize-horizontal-end="noTransition = false"
      @reset-width="onResetWidth"
    >
      <template #default="{ isCollapsed }">
        <div class="flex h-full flex-col" data-theme="dark">
          <LeftSidebarHeader
            v-model:search="quickSearchValue"
            v-model:search-active="isQuickSearchActive"
            class="px-3 pt-2.5 pb-1"
            :collapsed="isCollapsed"
          />

          <!-- Attractive Subtle Divider -->
          <div v-if="!isCollapsed" class="flex w-full items-center justify-center gap-2 px-4 my-2 opacity-60 select-none">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div class="h-1 w-1 rounded-full bg-white/30 ring-2 ring-white/10" />
            <div class="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-transparent" />
          </div>
          <div v-else class="flex w-full items-center justify-center my-2 opacity-40 select-none">
            <div class="w-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          <QuickSearch
            v-show="isQuickSearchActive"
            :search="quickSearchValue"
            class="mb-3 px-3"
            :collapsed="isCollapsed"
          />
          <PageNavigation
            v-show="!isQuickSearchActive"
            class="px-3"
            :class="{ 'mb-1': !isCollapsed }"
            :collapsed="isCollapsed"
          />

          <!-- Attractive Subtle Divider -->
          <div v-if="!isCollapsed && !isQuickSearchActive" class="flex w-full items-center justify-center gap-2 px-4 my-2 opacity-60 select-none">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div class="h-1 w-1 rounded-full bg-white/30 ring-2 ring-white/10" />
            <div class="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-transparent" />
          </div>
          <div v-else-if="!isQuickSearchActive" class="flex w-full items-center justify-center my-2 opacity-40 select-none">
            <div class="w-6 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          <UserTaskbarTabs v-show="!isQuickSearchActive" class="px-3" :collapsed="isCollapsed" />

          <!-- Attractive Subtle Divider before footer -->
          <div v-if="!isCollapsed && !isQuickSearchActive" class="flex w-full items-center justify-center gap-2 px-4 mt-auto mb-1 opacity-60 select-none">
            <div class="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
            <div class="h-1 w-1 rounded-full bg-white/30 ring-2 ring-white/10" />
            <div class="h-px flex-1 bg-gradient-to-l from-transparent via-white/15 to-transparent" />
          </div>

          <LeftSidebarFooterMenu
            v-show="!isQuickSearchActive"
            class="mt-auto"
            :class="{ 'p-3': !isCollapsed }"
          />
        </div>
      </template>
    </LayoutSidebar>

    <div id="main-content" class="relative">
      <RouterView #default="{ Component, route: currentRoute }">
        <KeepAlive :exclude="['ErrorTab']" :max="config.ui_task_mananger_max_task_count">
          <component
            :is="Component"
            v-if="!currentRoute.meta.permanentItem"
            :key="currentRoute.meta.pageKey || currentRoute.path"
          />
        </KeepAlive>
        <KeepAlive :max="numberOfPermanentItems">
          <component
            :is="Component"
            v-if="currentRoute.meta.permanentItem"
            :key="currentRoute.meta.pageKey || currentRoute.path"
          />
        </KeepAlive>
      </RouterView>
    </div>
  </div>
</template>
