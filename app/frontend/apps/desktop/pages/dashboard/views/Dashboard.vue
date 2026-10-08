<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import StudenthubAdminDashboard from '#desktop/pages/dashboard/components/StudenthubAdminDashboard.vue'
import StudenthubAgentDashboard from '#desktop/pages/dashboard/components/StudenthubAgentDashboard.vue'
import StudenthubManagerDashboard from '#desktop/pages/dashboard/components/StudenthubManagerDashboard.vue'

import '#desktop/pages/dashboard/styles/studenthub-dashboard.css'

// Student Hub: which dashboard. Managers without another staff role get their approvals; admins
// the team overview (and their own figures under "My work", when they also work on tickets);
// agents their briefing.
const { hasPermission } = useSessionStore()
const { isLoaded: isViewerLoaded, isManagerOnly } = useStudenthubApprovalViewer()

useStudenthubTopBarCrumbsWhileShown([{ label: __('Dashboard') }])

const isAdmin = computed(() => hasPermission('admin'))
const canSwitch = computed(() => isAdmin.value && hasPermission('ticket.agent'))

// The admin's choice is kept in this browser.
const VIEW_KEY = 'studenthub-dashboard-view'

const readView = () => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'mine' ? 'mine' : 'team'
  } catch {
    return 'team'
  }
}

const view = ref<'team' | 'mine'>(readView())

watch(view, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // Not kept; the team overview opens next time.
  }
})

const showTeamOverview = computed(() => isAdmin.value && (!canSwitch.value || view.value === 'team'))
</script>

<template>
  <StudenthubManagerDashboard v-if="isManagerOnly" />
  <LayoutMain v-else-if="isViewerLoaded" background-variant="tertiary" class="p-6 md:p-8">
    <div class="sh-dash" style="gap: 0.75rem">
      <div v-if="canSwitch" class="sh-dash-switch" role="group" :aria-label="$t('Dashboard view')">
        <button type="button" :aria-pressed="view === 'team'" @click="view = 'team'">
          {{ $t('Team overview') }}
        </button>
        <button type="button" :aria-pressed="view === 'mine'" @click="view = 'mine'">
          {{ $t('My work') }}
        </button>
      </div>

      <StudenthubAdminDashboard v-if="showTeamOverview" />
      <StudenthubAgentDashboard v-else />
    </div>
  </LayoutMain>
</template>
