// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { getGraphQLMockCalls } from '#tests/graphql/builders/mocks.ts'
import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { visitView } from '#tests/support/components/visitView.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import type { TicketsCachedByOverviewQuery } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import {
  mockDefaultOverviewQueries,
  mockDefaultTicketsCachedByOverview,
} from './mocks/ticket-overviews-mocks.ts'

// Student Hub: the Tickets page is kept alive while another page is open. Coming back with another
// view (e.g. "View team" on the Dashboard) used to refetch the old view at the same time as loading
// the new one, which sent the tickets query without an overview.
describe('TicketOverviews: back from another page with another view', () => {
  beforeEach(() => {
    mockPermissions(['ticket.agent'])
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the new view without errors', async () => {
    mockDefaultOverviewQueries()
    mockDefaultTicketsCachedByOverview()

    await visitView('tickets/view/my_assigned')

    const router = getTestRouter()
    await router.push('/dashboard')
    await router.push('/tickets/view/new_tickets')

    await waitFor(() => {
      const calls = getGraphQLMockCalls<TicketsCachedByOverviewQuery>(
        'query',
        'ticketsCachedByOverview',
      )
      expect(calls.at(-1)?.variables).toEqual(
        expect.objectContaining({ overviewId: convertToGraphQLId('Overview', 2) }),
      )
    })

    const calls = getGraphQLMockCalls<TicketsCachedByOverviewQuery>(
      'query',
      'ticketsCachedByOverview',
    )
    calls.forEach((call) => expect(call.variables).toHaveProperty('overviewId'))
  })
})
