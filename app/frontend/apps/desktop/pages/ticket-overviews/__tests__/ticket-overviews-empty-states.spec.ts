// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { mockCurrentUserQuery } from '#shared/graphql/queries/currentUser.mocks.ts'

import {
  mockDefaultOverviewQueries,
  mockEmptyTicketsCachedByOverview,
} from './mocks/ticket-overviews-mocks.ts'

describe('Ticket Overviews > Empty states', () => {
  it('displays a message to the agent when no overviews are available.', async () => {
    mockDefaultOverviewQueries([])

    const view = await visitView('tickets/view')

    expect(
      await view.findByText(
        'Currently, no overviews are assigned to your roles. Please contact your administrator.',
      ),
    ).toBeInTheDocument()

    // Student Hub: the navigation panel has a heading of its own
    expect(view.getByRole('heading', { level: 2, name: /No overviews/ })).toBeInTheDocument()

    expect(view.getByIconName('exclamation-triangle')).toBeInTheDocument()

    // Student Hub: the views are in the navigation panel ("My views")
    expect(
      view.queryByRole('navigation', { name: 'Overview navigation list' }),
    ).not.toBeInTheDocument()
  })

  it('displays a ticket create message to the customer when no tickets are available and no ticket history', async () => {
    mockDefaultOverviewQueries()

    mockCurrentUserQuery({
      currentUser: {
        preferences: {
          tickets_closed: 0,
          tickets_open: 0,
          overviews_last_used: {},
        },
      },
    })

    mockEmptyTicketsCachedByOverview()

    mockPermissions(['ticket.customer'])

    mockApplicationConfig({ customer_ticket_create: true })

    const view = await visitView('tickets/view')

    // Student Hub: students get their own Tickets page ("My Tickets"), with its own empty state
    expect(await view.findByRole('heading', { name: /My Tickets/ })).toBeInTheDocument()

    expect(await view.findByText('No tickets yet')).toBeInTheDocument()
    expect(
      view.getByText('Whenever you submit an enquiry, your tickets will appear here.'),
    ).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Raise a New Ticket' }))

    const router = getTestRouter()

    await waitFor(() => expect(router.currentRoute.value.name).toBe('TicketCreate'))
  })

  it('displays a message indicating no tickets are available when the overview is empty', async () => {
    mockDefaultOverviewQueries()

    mockCurrentUserQuery({
      currentUser: {
        preferences: {
          tickets_closed: 1,
          tickets_open: 2,
        },
      },
    })

    mockEmptyTicketsCachedByOverview()

    mockPermissions(['ticket.agent'])

    const view = await visitView('tickets/view')

    // Student Hub: the navigation panel has a heading of its own
    expect(
      await view.findByRole('heading', { level: 2, name: 'Empty overview' }),
    ).toBeInTheDocument()

    expect(view.getByText('No tickets in this state.')).toBeInTheDocument()
  })
})
