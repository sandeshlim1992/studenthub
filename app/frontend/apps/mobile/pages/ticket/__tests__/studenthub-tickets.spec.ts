// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockTicketOverviews } from '#tests/support/mocks/ticket-overviews.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'
import { EnumOrderDirection } from '#shared/graphql/types.ts'

import {
  mockMyTickets,
  mockMyTicketsOverview,
  studentTicket,
} from '#mobile/entities/ticket/__tests__/mocks/studenthubMyTickets.ts'

const tickets = [
  studentTicket(1, 'Moodle login not working', '4. Awaiting user Response', 'open'),
  studentTicket(2, 'Request for New ID Card', '3. In Progress', 'open'),
  studentTicket(3, 'Laptop charger replacement', '1. New', 'new'),
  studentTicket(4, 'Wi-Fi password reset', '6. Closed', 'closed'),
  studentTicket(5, 'Library card not scanning', '5. Resolved', 'open'),
]

const ticketTitles = (view: Awaited<ReturnType<typeof visitView>>) =>
  view
    .getAllByRole('link', { name: /#8868/ })
    .map((link) => link.querySelector('span span')?.textContent)

// Student Hub: the students' Tickets tab.
describe('Student Hub Tickets tab', () => {
  beforeEach(() => {
    mockPermissions(['ticket.customer'])
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
  })

  it("lists the student's own tickets, latest change first", async () => {
    mockMyTicketsOverview()
    const ticketsMock = mockMyTickets(tickets)

    const view = await visitView('/tickets')

    const moodle = await view.findByRole('link', { name: /Moodle login not working/ })

    expect(view.getByRole('heading', { name: 'Your tickets' })).toBeInTheDocument()
    expect(ticketsMock.spies.resolve).toHaveBeenCalledWith(
      expect.objectContaining({
        overviewId: '1',
        orderBy: 'updated_at',
        orderDirection: EnumOrderDirection.Descending,
      }),
    )

    expect(moodle).toHaveAttribute('href', '/mobile/tickets/1')
    expect(moodle).toHaveTextContent('#88681')
    expect(moodle).toHaveTextContent('Waiting for you')
    expect(ticketTitles(view)).toHaveLength(5)
  })

  it('puts the latest change first, whatever order the My Tickets view gives', async () => {
    mockMyTicketsOverview()
    // A view grouped by state sends them by state first.
    mockMyTickets([
      {
        ...studentTicket(1, 'Older change', '3. In Progress', 'open'),
        updatedAt: '2026-10-01T10:00:00Z',
      },
      {
        ...studentTicket(2, 'Middle change', '2. Assigned', 'open'),
        updatedAt: '2026-10-02T10:00:00Z',
      },
      { ...studentTicket(3, 'Newest change', '1. New', 'new'), updatedAt: '2026-10-03T10:00:00Z' },
    ])

    const view = await visitView('/tickets')
    await view.findByRole('link', { name: /Newest change/ })

    expect(ticketTitles(view)).toEqual(['Newest change', 'Middle change', 'Older change'])
  })

  it('sorts by state, in the order a ticket goes through', async () => {
    mockMyTicketsOverview()
    mockMyTickets(tickets)

    const view = await visitView('/tickets')
    await view.findByRole('link', { name: /Moodle login not working/ })

    await view.events.selectOptions(view.getByRole('combobox', { name: 'Sort by' }), 'State')

    expect(ticketTitles(view)).toEqual([
      'Laptop charger replacement',
      'Request for New ID Card',
      'Moodle login not working',
      'Library card not scanning',
      'Wi-Fi password reset',
    ])

    await view.events.selectOptions(
      view.getByRole('combobox', { name: 'Sort by' }),
      'Latest change',
    )

    expect(ticketTitles(view)[0]).toBe('Moodle login not working')
  })

  it('searches the titles and numbers', async () => {
    mockMyTicketsOverview()
    mockMyTickets(tickets)

    const view = await visitView('/tickets')

    await view.events.type(
      await view.findByRole('searchbox', { name: 'Search your tickets' }),
      'card',
    )

    expect(ticketTitles(view)).toEqual(['Request for New ID Card', 'Library card not scanning'])

    await view.events.clear(view.getByRole('searchbox', { name: 'Search your tickets' }))
    await view.events.type(view.getByRole('searchbox', { name: 'Search your tickets' }), '88683')

    expect(ticketTitles(view)).toEqual(['Laptop charger replacement'])
    expect(view.queryByText('No entries')).not.toBeInTheDocument()
  })

  it('says so when the My Tickets view is missing', async () => {
    mockTicketOverviews()

    const view = await visitView('/tickets')

    expect(await view.findByText('Your tickets cannot be shown here.')).toBeInTheDocument()
  })
})
