// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'

import { useTicketOverviews } from './useTicketOverviews.ts'

// Student Hub: sorts the overviews of the views panel into "Approval needed", "My views", "Teams"
// and "Institutions" (GET /api/v1/studenthub/ticket_views, see Studenthub::TicketViews).
// If the request fails, everything simply stays under "My views".

export type StudenthubTicketViewSection = 'approvals' | 'mine' | 'teams' | 'institutions'

interface Sections {
  teams: { overview_id: number; group_id: number }[]
  hidden_overview_ids: number[]
  institution_overview_ids: number[]
  approval_overview_ids?: number[]
}

const sections = ref<Sections | null>(null)
let request: Promise<void> | null = null

const load = () => {
  // Promise.resolve().then: a fetch that throws straight away (as in unit tests) is caught too.
  request ||= Promise.resolve()
    .then(() =>
      fetch('/api/v1/studenthub/ticket_views', {
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
      }),
    )
    .then((response) => (response.ok ? response.json() : null))
    .then((data) => {
      sections.value = data
    })
    .catch(() => {
      request = null
    })

  return request
}

export const sectionOfOverview = (
  overviewId: number,
  data: Sections | null,
): StudenthubTicketViewSection | null => {
  if (!data) return 'mine'
  if (data.hidden_overview_ids.includes(overviewId)) return null
  if (data.approval_overview_ids?.includes(overviewId)) return 'approvals'
  if (data.institution_overview_ids.includes(overviewId)) return 'institutions'
  if (data.teams.some((team) => team.overview_id === overviewId)) return 'teams'
  return 'mine'
}

export const useStudenthubTicketViews = () => {
  const { overviews } = useTicketOverviews()

  load()

  const overviewsBySection = computed(() => {
    const result: Record<StudenthubTicketViewSection, typeof overviews.value> = {
      approvals: [],
      mine: [],
      teams: [],
      institutions: [],
    }

    overviews.value?.forEach((overview) => {
      const section = sectionOfOverview(getIdFromGraphQLId(overview.id), sections.value)
      if (section) result[section].push(overview)
    })

    return result
  })

  return { overviewsBySection }
}
