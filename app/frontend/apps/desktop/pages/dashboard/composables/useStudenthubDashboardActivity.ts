// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: the latest ticket activity on the dashboards
// (GET /api/v1/studenthub/dashboard/activity, Service::StudenthubDashboard::Activity).

export interface StudenthubDashboardActivityItem {
  id: number
  action: 'created' | 'updated' | 'replied' | 'wrote' | 'noted'
  ticket: { id: number; number: string; title: string }
  actor: { id: number | null; name: string | null }
  created_at: string
}

export const useStudenthubDashboardActivity = () => {
  const items = ref<StudenthubDashboardActivityItem[]>([])
  const isLoading = ref(false)
  const loadFailed = ref(false)

  const load = async () => {
    isLoading.value = true
    try {
      const data = await studenthubApi<{ items: StudenthubDashboardActivityItem[] }>(
        '/api/v1/studenthub/dashboard/activity',
      )
      items.value = data.items
      loadFailed.value = false
    } catch {
      loadFailed.value = true
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, loadFailed, load }
}
