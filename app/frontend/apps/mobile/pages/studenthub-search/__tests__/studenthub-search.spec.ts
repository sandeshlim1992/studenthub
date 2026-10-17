// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import { mockStudenthubTicketSearchQuery } from '../graphql/queries/studenthubTicketSearch.mocks.ts'

const choices = (...names: string[]) => names.map((name) => ({ name, value: name }))

const metadata = {
  categories: choices('Service Request', 'Hardware'),
  subcategories_by_category: {
    'Service Request': choices('New ID Card', 'Password Reset'),
    Hardware: choices('Card reader', 'Printer'),
  },
  campuses: choices('LSST Wembley'),
}

const article = {
  id: 3,
  title: 'Lost or damaged student ID card',
  topic: 'Enrolment & ID cards',
  snippet: 'Raise a request so we can cancel the old card…',
}

const ticket = (internalId: number, title: string, customerId: number) => ({
  __typename: 'Ticket' as const,
  id: convertToGraphQLId('Ticket', internalId),
  internalId,
  number: `8868${internalId}`,
  title,
  updatedAt: '2026-10-01T10:00:00Z',
  customer: {
    __typename: 'User' as const,
    id: convertToGraphQLId('User', customerId),
    internalId: customerId,
  },
  state: {
    __typename: 'TicketState' as const,
    id: convertToGraphQLId('Ticket::State', 3),
    name: '3. In Progress',
    stateType: {
      __typename: 'TicketStateType' as const,
      id: convertToGraphQLId('Ticket::StateType', 2),
      name: 'open',
    },
  },
})

const mockServer = (articles: unknown[]) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/v1/studenthub/ticket_wizard_metadata')
        return new Response(JSON.stringify(metadata))
      if (url.startsWith('/api/v1/studenthub/mobile_app/knowledge_base/search?'))
        return new Response(JSON.stringify(articles))
      return new Response('{}', { status: 404 })
    }),
  )
}

const sectionHeadings = (view: Awaited<ReturnType<typeof visitView>>) =>
  view.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent?.trim())

const searchFor = async (view: Awaited<ReturnType<typeof visitView>>, words: string) => {
  await view.events.type(
    view.getByRole('searchbox', { name: 'Search help articles, requests and your tickets' }),
    words,
  )
}

// Student Hub: the students' search from Home.
describe('Student Hub search for students', () => {
  beforeEach(() => {
    mockUserCurrent({ internalId: 2 })
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: true, kb_active: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows help articles first, then requests to raise, then the student's own tickets", async () => {
    mockServer([article])
    mockStudenthubTicketSearchQuery({
      search: {
        items: [ticket(60, 'Request for New ID Card', 2), ticket(61, 'Card of a classmate', 9)],
      },
    })

    const view = await visitView('/find', { mockApollo: false })
    await searchFor(view, 'card')

    const tickets = within(await view.findByRole('region', { name: 'Your tickets' }))
    await view.findByRole('region', { name: 'Help articles' })

    expect(sectionHeadings(view)).toEqual(['Help articles', 'Raise a request', 'Your tickets'])
    expect(
      within(view.getByRole('region', { name: 'Help articles' })).getByRole('link', {
        name: /Lost or damaged student ID card/,
      }),
    ).toHaveAttribute('href', '/mobile/knowledge-base/answers/3')

    const requests = within(view.getByRole('region', { name: 'Raise a request' }))
    expect(requests.getAllByRole('link').map((link) => link.textContent?.trim())).toEqual([
      'New ID CardService Request',
      'Card readerHardware',
    ])
    expect(requests.getByRole('link', { name: /New ID Card/ })).toHaveAttribute(
      'href',
      '/mobile/tickets/request?category=Service+Request&sub_category=New+ID+Card',
    )

    expect(tickets.getByRole('link', { name: /Request for New ID Card/ })).toHaveAttribute(
      'href',
      '/mobile/tickets/60',
    )
    expect(tickets.queryByText('Card of a classmate')).not.toBeInTheDocument()
  })

  it('puts the requests to raise first when no help article matches', async () => {
    mockServer([])
    mockStudenthubTicketSearchQuery({ search: { items: [ticket(60, 'Printer jam', 2)] } })

    const view = await visitView('/find', { mockApollo: false })
    await searchFor(view, 'printer')

    await view.findByRole('region', { name: 'Your tickets' })

    expect(sectionHeadings(view)).toEqual(['Raise a request', 'Your tickets'])
  })

  it('says when nothing matches and offers to raise a request', async () => {
    mockServer([])
    mockStudenthubTicketSearchQuery({ search: { items: [] } })

    const view = await visitView('/find', { mockApollo: false })
    await searchFor(view, 'parking')

    expect(await view.findByText('Nothing matches “parking”.')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Raise a request' })).toHaveAttribute(
      'href',
      '/mobile/tickets/request',
    )
    expect(view.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  })
})
