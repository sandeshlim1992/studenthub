// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

import { mockMyTicketsOverview } from '#mobile/entities/ticket/__tests__/mocks/studenthubMyTickets.ts'

const latestTicket = (id: number, title: string, state: string, stateType: string) => ({
  id,
  number: `8868${id}`,
  title,
  updated_at: '2026-10-01T10:00:00Z',
  state,
  state_type: stateType,
})

const mockLatest = (ticket: ReturnType<typeof latestTicket> | null) => {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/v1/studenthub/customer_tickets/latest')
      return new Response(JSON.stringify(ticket))
    return new Response('[]')
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Student Hub: Home for students (design C1 with C3's latest ticket).
describe('Student Hub home', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Sam' })
    mockPermissions(['ticket.customer'])
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
    mockMyTicketsOverview()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('greets the student and shows the newest ticket they raised and how far it has come', async () => {
    const fetchMock = mockLatest(
      latestTicket(60, 'Request for New ID Card', '3. In Progress', 'open'),
    )

    const view = await visitView('/')

    expect(view.getByRole('heading', { name: 'How can we help, Sam?' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Search…' })).toHaveAttribute('href', '/mobile/find')

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
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/studenthub/customer_tickets/latest',
      expect.anything(),
    )
  })

  it('names the step the student is needed at', async () => {
    mockLatest(latestTicket(71, 'Moodle login not working', '4. Awaiting user Response', 'open'))

    const view = await visitView('/')
    const latest = await view.findByRole('link', { name: /Your latest ticket/ })

    expect(within(latest).getByText('Waiting for you')).toHaveAttribute('aria-current', 'step')
  })

  it('shows no latest ticket to a student without tickets', async () => {
    mockLatest(null)

    const view = await visitView('/')
    await view.findByRole('link', { name: 'Search…' })

    expect(view.queryByRole('link', { name: /Your latest ticket/ })).not.toBeInTheDocument()
    expect(view.queryByText('Ticket overview')).not.toBeInTheDocument()
  })
})
