// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  getApiTicketOverviews,
  mockTicketOverviews,
} from '#tests/support/mocks/ticket-overviews.ts'

import {
  mockTicketsByOverview,
  ticketDefault,
} from '#mobile/pages/ticket/__tests__/mocks/overview.ts'

// Student Hub: a student's "My Tickets" view and the tickets in it.

export const mockMyTicketsOverview = () => {
  const { ticketOverviews } = getApiTicketOverviews()
  const [first, ...others] = ticketOverviews

  return mockTicketOverviews({
    ticketOverviews: [{ ...first!, name: 'My Tickets', link: 'my_tickets' }, ...others],
  })
}

export const studentTicket = (id: number, title: string, stateName: string, stateType: string) => ({
  ...ticketDefault(),
  id: `ticket-${id}`,
  internalId: id,
  number: `8868${id}`,
  title,
  state: {
    __typename: 'TicketState' as const,
    id: `state-${id}`,
    name: stateName,
    stateType: { __typename: 'TicketStateType' as const, id: `state-type-${id}`, name: stateType },
  },
})

export const mockMyTickets = (
  tickets = [studentTicket(1, 'Moodle login not working', '4. Awaiting user Response', 'open')],
) => mockTicketsByOverview(tickets, { hasNextPage: false })
