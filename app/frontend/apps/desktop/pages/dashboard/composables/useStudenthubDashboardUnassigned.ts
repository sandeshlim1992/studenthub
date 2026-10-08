// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: unassigned tickets in each of the agent's teams
// (GET /api/v1/studenthub/dashboard/unassigned, Service::StudenthubDashboard::Unassigned).

export interface StudenthubUnassignedTicket {
  id: number
  number: string
  title: string
  created_at: string
}

export interface StudenthubUnassignedTeam {
  id: number
  name: string
  count: number
  overdue: number
  oldest: StudenthubUnassignedTicket[]
  view_link: string | null
}

export const useStudenthubDashboardUnassigned = () => {
  const teams = ref<StudenthubUnassignedTeam[]>([])
  const isLoading = ref(false)
  const loadFailed = ref(false)

  const load = async () => {
    isLoading.value = true
    try {
      const data = await studenthubApi<{ teams: StudenthubUnassignedTeam[] }>(
        '/api/v1/studenthub/dashboard/unassigned',
      )
      teams.value = data.teams
      loadFailed.value = false
    } catch {
      loadFailed.value = true
    } finally {
      isLoading.value = false
    }
  }

  return { teams, isLoading, loadFailed, load }
}
