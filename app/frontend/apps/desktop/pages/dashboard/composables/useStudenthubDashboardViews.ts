// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import type {
  StudenthubDashboardView,
  StudenthubDashboardViewKey,
} from '#desktop/pages/dashboard/utils/studenthubDashboard.ts'

// Student Hub: which dashboard. Admins get the team overview, agents their briefing ("My work")
// and managers their approvals; users with more than one switch between them, on the page or in
// the navigation panel (both use this). Managers without another staff role only get their
// approvals (their role carries ticket.agent, so the server tells them apart).

// The choice is kept in this browser.
const VIEW_KEY = 'studenthub-dashboard-view'

const chosen = ref('')
let isRestored = false

// The dashboard page reads the kept choice when it opens.
export const restoreStudenthubDashboardView = () => {
  try {
    chosen.value = localStorage.getItem(VIEW_KEY) ?? ''
  } catch {
    chosen.value = ''
  }
  isRestored = true
}

const keepView = (value: string) => {
  try {
    localStorage.setItem(VIEW_KEY, value)
  } catch {
    // Not kept; the first dashboard opens next time.
  }
}

export const useStudenthubDashboardViews = () => {
  if (!isRestored) restoreStudenthubDashboardView()

  const { hasPermission } = useSessionStore()
  const { isApprover, isManagerOnly } = useStudenthubApprovalViewer()

  const views = computed(() => {
    const list: StudenthubDashboardView[] = []

    if (hasPermission('admin')) list.push({ value: 'team', label: __('Team overview') })
    if (hasPermission('ticket.agent') && !isManagerOnly.value)
      list.push({ value: 'mine', label: __('My work') })
    if (isApprover.value) list.push({ value: 'approvals', label: __('Approvals') })

    return list
  })

  // A choice the user no longer has (e.g. a role was removed) falls back to the first one.
  const view = computed<StudenthubDashboardViewKey | undefined>({
    get: () =>
      views.value.find((item) => item.value === chosen.value)?.value ?? views.value[0]?.value,
    set: (value) => {
      chosen.value = value ?? ''
      keepView(chosen.value)
    },
  })

  const canSwitch = computed(() => views.value.length > 1)

  return { views, view, canSwitch }
}
