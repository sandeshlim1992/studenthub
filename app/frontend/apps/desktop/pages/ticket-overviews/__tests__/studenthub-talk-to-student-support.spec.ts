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

// Student Hub: students see "Talk to Student Support" only while Departments are on.
const visitStudentHome = (config: Record<string, unknown>) => {
  mockDefaultOverviewQueries()
  mockCurrentUserQuery({
    currentUser: {
      preferences: { tickets_closed: 0, tickets_open: 0, overviews_last_used: {} },
    },
  })
  mockEmptyTicketsCachedByOverview()
  mockPermissions(['ticket.customer'])
  mockApplicationConfig({ customer_ticket_create: true, ...config })

  return visitView('tickets/view')
}

describe('Ticket Overviews > Talk to Student Support', () => {
  it('is hidden while Departments are off', async () => {
    const view = await visitStudentHome({ studenthub_departments: false })

    expect(await view.findByRole('heading', { name: 'How can we help?' })).toBeInTheDocument()
    expect(
      view.queryByRole('button', { name: 'Talk to Student Support' }),
    ).not.toBeInTheDocument()
  })

  it('opens the ticket wizard while Departments are on', async () => {
    const view = await visitStudentHome({ studenthub_departments: true })

    await view.events.click(await view.findByRole('button', { name: 'Talk to Student Support' }))

    const router = getTestRouter()

    await waitFor(() => expect(router.currentRoute.value.name).toBe('TicketCreate'))
    expect(router.currentRoute.value.query).toEqual({ mode: 'wizard' })
  })
})
