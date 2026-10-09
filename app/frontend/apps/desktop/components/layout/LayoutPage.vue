<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { delay } from 'lodash-es'
import { computed, onBeforeMount, toRef, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useReducedMotion } from '#shared/composables/useReducedMotion.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import emitter from '#shared/utils/emitter.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import CustomerHeader from '#desktop/components/Customer/CustomerHeader.vue'
import CustomerSidebar from '#desktop/components/Customer/CustomerSidebar.vue'
import { hasStudenthubNavPanel } from '#desktop/components/layout/StudenthubNav/studenthubNav.ts'
import StudenthubNavPanel from '#desktop/components/layout/StudenthubNav/StudenthubNavPanel.vue'
import StudenthubNavRail from '#desktop/components/layout/StudenthubNav/StudenthubNavRail.vue'
import StudenthubTopBar from '#desktop/components/layout/StudenthubTopBar/StudenthubTopBar.vue'
import { numberOfPermanentItems } from '#desktop/components/PageNavigation/firstLevelRoutes.ts'
import { useAppBreakpoints } from '#desktop/composables/responsiveness/useAppBreakpoints.ts'

import { SidebarName } from './types.ts'
import { useSidebarDisplay } from './useSidebarDisplay.ts'

const config = toRef(useApplicationStore(), 'config')

const { isSmallScreen, isSmallestScreen } = useAppBreakpoints()

// Student Hub: navigation design C. The rail is always shown; the panel beside it can be hidden,
// which is Zammad's collapsed primary sidebar (same remembered state, same small-screen rules).
// Administration and Reporting have no panel.
const RAIL_WIDTH = 68
const NAV_PANEL_WIDTH = 224

const { isSidebarCollapsed: isNavPanelHidden, toggleSidebar: togglePrimaryNavSidebar } =
  useSidebarDisplay(SidebarName.Primary)

const { isSidebarCollapsed: isContentSidebarCollapsed } = useSidebarDisplay(
  SidebarName.TicketContent,
)

const route = useRoute()

const isNavPanelShown = computed(() => !isNavPanelHidden.value && hasStudenthubNavPanel(route))

const gridColumns = computed(() =>
  !isNavPanelShown.value
    ? `${RAIL_WIDTH}px minmax(0, 1fr)`
    : `${RAIL_WIDTH}px ${NAV_PANEL_WIDTH}px minmax(0, 1fr)`,
)

const emitSidebarEvent = (wait = 100) => {
  delay(() => {
    emitter.emit('primary-sidebar-transition')
  }, wait)
}

watch(isNavPanelShown, () => emitSidebarEvent())

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
  <div v-if="isCustomer" class="flex h-full w-full flex-col overflow-hidden bg-[#f8fafc]">
    <!-- Persistent Customer Top Bar with Brand Logo & Profile Dropdown -->
    <CustomerHeader />

    <!-- Main Customer Body -->
    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      <!-- Left Sidebar with Recent Tickets (rendered on ticket detail / ticket create views) -->
      <CustomerSidebar v-if="showCustomerSidebar" />

      <!-- Center Content Area -->
      <div id="main-content" class="relative h-full min-w-0 flex-1 overflow-y-auto">
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
    :class="{ 'transition-none': hasReducedMotion }"
    class="grid h-full max-h-full grid-cols-(--grid-columns) overflow-y-clip duration-100 print:h-auto print:max-h-none print:grid-cols-1 print:overflow-visible"
  >
    <StudenthubNavRail />
    <StudenthubNavPanel v-if="isNavPanelShown" />

    <div id="main-content" class="relative flex min-h-0 flex-col">
      <StudenthubTopBar />
      <div class="relative min-h-0 flex-1">
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
</template>
