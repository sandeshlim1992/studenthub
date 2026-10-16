// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

import {
  mockMyTickets,
  mockMyTicketsOverview,
  studentTicket,
} from '#mobile/entities/ticket/__tests__/mocks/studenthubMyTickets.ts'

// Student Hub: Home for students (design C1 with C3's latest ticket).
describe('Student Hub home', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Sam' })
    mockPermissions(['ticket.customer'])
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
    mockMyTicketsOverview()
  })

  it('greets the student and shows their latest ticket and how far it has come', async () => {
    mockMyTickets([
      studentTicket(60, 'Request for New ID Card', '3. In Progress', 'open'),
      studentTicket(61, 'Wi-Fi password reset', '6. Closed', 'closed'),
    ])

    const view = await visitView('/')

    expect(view.getByRole('heading', { name: 'How can we help, Sam?' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Search…' })).toHaveAttribute('href', '/mobile/search')

    const latest = await view.findByRole('link', { name: /Your latest ticket/ })

    expect(latest).toHaveAttribute('href', '/mobile/tickets/60')
    expect(latest).toHaveTextContent('#886860')
    expect(latest).toHaveTextContent('Request for New ID Card')
    expect(
      within(latest)
        .getAllByRole('listitem')
        .map((step) => step.textContent?.trim()),
    ).toEqual(['Received', 'In progress', 'Resolved'])
    expect(within(latest).getByText('In progress')).toHaveAttribute('aria-current', 'step')
    expect(view.queryByText('Wi-Fi password reset')).not.toBeInTheDocument()
  })

  it('names the step the student is needed at', async () => {
    mockMyTickets([
      studentTicket(71, 'Moodle login not working', '4. Awaiting user Response', 'open'),
    ])

    const view = await visitView('/')
    const latest = await view.findByRole('link', { name: /Your latest ticket/ })

    expect(within(latest).getByText('Waiting for you')).toHaveAttribute('aria-current', 'step')
  })

  it('shows no latest ticket to a student without tickets', async () => {
    mockMyTickets([])

    const view = await visitView('/')

    expect(view.queryByRole('link', { name: /Your latest ticket/ })).not.toBeInTheDocument()
    expect(view.queryByText('Ticket overview')).not.toBeInTheDocument()
  })
})
