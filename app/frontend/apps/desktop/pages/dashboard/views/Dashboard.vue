<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import StudenthubAdminDashboard from '#desktop/pages/dashboard/components/StudenthubAdminDashboard.vue'
import StudenthubAgentDashboard from '#desktop/pages/dashboard/components/StudenthubAgentDashboard.vue'
import StudenthubDashboardSwitch from '#desktop/pages/dashboard/components/StudenthubDashboardSwitch.vue'
import StudenthubManagerDashboard from '#desktop/pages/dashboard/components/StudenthubManagerDashboard.vue'
import type { StudenthubDashboardView } from '#desktop/pages/dashboard/utils/studenthubDashboard.ts'

import '#desktop/pages/dashboard/styles/studenthub-dashboard.css'

// Student Hub: which dashboard. Admins get the team overview, agents their briefing ("My work")
// and managers their approvals; users with more than one switch between them. Managers without
// another staff role only get their approvals (their role carries ticket.agent, so the server
// tells them apart).
const { hasPermission } = useSessionStore()
const { isLoaded: isViewerLoaded, isApprover, isManagerOnly } = useStudenthubApprovalViewer()

useStudenthubTopBarCrumbsWhileShown([{ label: __('Dashboard') }])

const views = computed(() => {
  const list: StudenthubDashboardView[] = []

  if (hasPermission('admin')) list.push({ value: 'team', label: __('Team overview') })
  if (hasPermission('ticket.agent') && !isManagerOnly.value)
    list.push({ value: 'mine', label: __('My work') })
  if (isApprover.value) list.push({ value: 'approvals', label: __('Approvals') })

  return list
})

// The choice is kept in this browser.
const VIEW_KEY = 'studenthub-dashboard-view'

const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) ?? ''
  } catch {
    return ''
  }
}

const chosen = ref(readView())

watch(chosen, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // Not kept; the first dashboard opens next time.
  }
})

// A choice the user no longer has (e.g. a role was removed) falls back to the first one.
const view = computed({
  get: () =>
    views.value.find((item) => item.value === chosen.value)?.value ?? views.value[0]?.value,
  set: (value) => {
    chosen.value = value ?? ''
  },
})

const canSwitch = computed(() => views.value.length > 1)
</script>

<template>
  <template v-if="isViewerLoaded">
    <StudenthubManagerDashboard v-if="view === 'approvals'">
      <template v-if="canSwitch" #top>
        <StudenthubDashboardSwitch v-model="view" :views="views" />
      </template>
    </StudenthubManagerDashboard>
    <LayoutMain v-else background-variant="tertiary" class="p-6 md:p-8">
      <div class="sh-dash" style="gap: 0.75rem">
        <StudenthubDashboardSwitch v-if="canSwitch" v-model="view" :views="views" />

        <StudenthubAdminDashboard v-if="view === 'team'" />
        <StudenthubAgentDashboard v-else />
      </div>
    </LayoutMain>
  </template>
</template>
