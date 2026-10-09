<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import StudenthubAdminDashboard from '#desktop/pages/dashboard/components/StudenthubAdminDashboard.vue'
import StudenthubAgentDashboard from '#desktop/pages/dashboard/components/StudenthubAgentDashboard.vue'
import StudenthubDashboardSwitch from '#desktop/pages/dashboard/components/StudenthubDashboardSwitch.vue'
import StudenthubManagerDashboard from '#desktop/pages/dashboard/components/StudenthubManagerDashboard.vue'
import {
  restoreStudenthubDashboardView,
  useStudenthubDashboardViews,
} from '#desktop/pages/dashboard/composables/useStudenthubDashboardViews.ts'

import '#desktop/pages/dashboard/styles/studenthub-dashboard.css'

// Student Hub: the dashboards (see useStudenthubDashboardViews). Users with more than one pick
// it in the navigation panel; while the panel is hidden, the switch is above the dashboard.
const { isLoaded: isViewerLoaded } = useStudenthubApprovalViewer()

restoreStudenthubDashboardView()
const { views, view, canSwitch } = useStudenthubDashboardViews()

const { isSidebarCollapsed: isNavPanelHidden } = useSidebarDisplay(SidebarName.Primary)
const showSwitch = computed(() => canSwitch.value && isNavPanelHidden.value)

// Top bar: "Dashboard / Team overview", following the switch.
useStudenthubTopBarCrumbsWhileShown(() => {
  const current = views.value.find((item) => item.value === view.value)
  if (!current) return [{ label: __('Dashboard') }]

  return [{ label: __('Dashboard'), route: '/dashboard' }, { label: current.label }]
})
</script>

<template>
  <template v-if="isViewerLoaded">
    <StudenthubManagerDashboard v-if="view === 'approvals'">
      <template v-if="showSwitch" #top>
        <StudenthubDashboardSwitch v-model="view" :views="views" />
      </template>
    </StudenthubManagerDashboard>
    <LayoutMain v-else background-variant="tertiary" class="p-6 md:p-8">
      <div class="sh-dash" style="gap: 0.75rem">
        <StudenthubDashboardSwitch v-if="showSwitch" v-model="view" :views="views" />

        <StudenthubAdminDashboard v-if="view === 'team'" />
        <StudenthubAgentDashboard v-else />
      </div>
    </LayoutMain>
  </template>
</template>
