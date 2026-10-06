// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: how an agent groups and sorts a ticket view, saved on the server per agent and
// view (/api/v1/studenthub/ticket_views/:id/choice). The server applies it to the view's grouping,
// order and columns, so after a change the view and its tickets are fetched again.

import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { getApolloClient } from '#shared/server/apollo/client.ts'
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'
import type { ObjectLike } from '#shared/types/utils.ts'

import type { TablePinnedGroup } from '#desktop/components/CommonTable/types.ts'

export interface StudenthubViewChoice {
  group_by: string
  order_by: string
  order_direction: 'ASC' | 'DESC'
  default_group_by: string
  customised: boolean
  grouping_options: { value: string; label: string }[]
}

const url = (overviewId: string) =>
  `/api/v1/studenthub/ticket_views/${getIdFromGraphQLId(overviewId)}/choice`

const request = async (overviewId: string, method = 'GET', body?: Record<string, string>) => {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
  if (method !== 'GET') {
    headers['Content-Type'] = 'application/json'
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token
  }

  const response = await fetch(url(overviewId), {
    method,
    credentials: 'same-origin',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `${response.status}`)
  return data as StudenthubViewChoice
}

export const loadStudenthubViewChoice = (overviewId: string) => request(overviewId)

// The view's grouping and columns come with the overview list; the tickets' cache key includes
// the choice, so both are fetched again.
const refetchView = () =>
  getApolloClient().refetchQueries({ include: ['userCurrentTicketOverviews', 'ticketsCachedByOverview'] })

export const saveStudenthubViewGrouping = async (overviewId: string, groupBy: string) => {
  const choice = await request(overviewId, 'PUT', { group_by: groupBy })
  await refetchView()
  return choice
}

export const resetStudenthubViewChoice = async (overviewId: string) => {
  const choice = await request(overviewId, 'DELETE')
  await refetchView()
  return choice
}

// Called when the agent sorts by a column; the list itself has already re-sorted.
export const saveStudenthubViewOrder = (overviewId: string, orderBy: string, orderDirection: string) =>
  request(overviewId, 'PUT', { order_by: orderBy, order_direction: orderDirection }).catch(() => undefined)

// Teams views (studenthub_team_<group id>): tickets without an owner (Zammad's user 1) form the
// first group, whatever the agent groups by; the server sorts them first.
export const isStudenthubTeamView = (link?: string) => Boolean(link?.startsWith('studenthub_team_'))

export const STUDENTHUB_UNASSIGNED_GROUP: TablePinnedGroup = {
  label: __('Unassigned tickets'),
  matches: (item) => {
    const owner = (item as ObjectLike).owner as { id?: string } | undefined
    return !owner?.id || getIdFromGraphQLId(owner.id) === 1
  },
}
