// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor, within } from '@testing-library/vue'
import { defineComponent, h, ref } from 'vue'

import { generateObjectData } from '#tests/graphql/builders/index.ts'
import { getGraphQLMockCalls } from '#tests/graphql/builders/mocks.ts'
import { renderComponent } from '#tests/support/components/index.ts'
import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'
import { EnumOrderDirection, type TicketsCachedByOverviewQuery } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import { mockOverviewsWithCachedCountQuery } from '#desktop/entities/ticket/graphql/queries/overviewsWithCachedCount.mocks.ts'
import { mockTicketsCachedByOverviewQuery } from '#desktop/entities/ticket/graphql/queries/ticketsCachedByOverview.mocks.ts'
import { mockUserCurrentTicketOverviewsQuery } from '#desktop/entities/ticket/graphql/queries/userCurrentTicketOverviews.mocks.ts'

import {
  useStudenthubTicketQueue,
  type StudenthubTicketQueue as Queue,
} from '../../../composables/useStudenthubTicketQueue.ts'
import StudenthubTicketQueue from '../StudenthubTicketQueue.vue'

const overviews = [
  {
    id: convertToGraphQLId('Overview', 1),
    name: 'Service Desk',
    link: 'studenthub_team_26',
    prio: 1000,
    orderBy: 'created_at',
    orderDirection: EnumOrderDirection.Ascending,
    viewColumns: [],
    orderColumns: [],
    active: true,
  },
  {
    id: convertToGraphQLId('Overview', 2),
    name: 'New Tickets',
    link: 'new_tickets',
    prio: 2000,
    orderBy: 'created_at',
    orderDirection: EnumOrderDirection.Ascending,
    viewColumns: [],
    orderColumns: [],
    active: true,
  },
]

const ticket = (id: string, number: string, title: string, ownerId: number, customer: string) => ({
  __typename: 'TicketEdge' as const,
  cursor: `cursor-${id}`,
  node: createDummyTicket({
    ticketId: id,
    number,
    title,
    owner: { id: convertToGraphQLId('User', ownerId), fullname: ownerId === 1 ? '-' : 'Someone' },
    customer: { id: convertToGraphQLId('User', 40 + Number(id)), fullname: customer },
    objectAttributeValues: [
      { attribute: { name: 'campus', display: 'Campus' }, value: 'LSST Wembley' },
    ],
  }),
})

const mockQueue = () => {
  mockUserCurrentTicketOverviewsQuery({ userCurrentTicketOverviews: overviews })
  mockOverviewsWithCachedCountQuery({ ticketOverviews: overviews })
  mockTicketsCachedByOverviewQuery({
    ticketsCachedByOverview: generateObjectData('CachedTicketConnection', {
      totalCount: 3,
      // User 2 is the signed-in agent; user 1 is Zammad's "nobody".
      edges: [
        ticket('11', '886849', 'Printer credit missing', 2, 'Amina Yusuf'),
        ticket('12', '886850', 'Laptop won’t join eduroam', 1, 'Helen Ward'),
        ticket('13', '886851', 'Moodle quiz will not open', 5, 'Daniel Osei'),
      ],
      pageInfo: { endCursor: 'MjU', hasNextPage: false },
    }),
  })
}

let queue: Queue
const currentTicketId = ref('12')

const renderQueue = () =>
  renderComponent(
    defineComponent({
      setup() {
        queue = useStudenthubTicketQueue(currentTicketId, ref(true))
        return () => h(StudenthubTicketQueue, { queue })
      },
    }),
    { router: true, store: true },
  )

describe('StudenthubTicketQueue', () => {
  beforeEach(() => {
    localStorage.clear()
    currentTicketId.value = '12'
    mockUserCurrent({ permissions: { names: ['ticket.agent'] } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    )
    mockQueue()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the tickets of the view and marks the open one', async () => {
    const view = renderQueue()

    const queueElement = await view.findByRole('complementary', { name: 'Ticket queue' })
    const rows = await within(queueElement).findAllByRole('listitem')

    expect(rows).toHaveLength(3)
    expect(rows[1]).toHaveTextContent('#886850')
    expect(rows[1]).toHaveTextContent('Laptop won’t join eduroam')
    expect(rows[1]).toHaveTextContent('Helen Ward')
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('aria-current', 'page')
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/desktop/tickets/12')
    expect(within(rows[0]).getByRole('link')).not.toHaveAttribute('aria-current')

    expect(view.getByRole('button', { name: 'Choose the view of the queue' })).toHaveTextContent(
      'Service Desk',
    )
    expect(queueElement).toHaveTextContent('3 tickets')
  })

  it('shows only my tickets or the unassigned ones', async () => {
    const view = renderQueue()

    await view.findAllByRole('listitem')

    await view.events.click(view.getByRole('button', { name: 'Mine' }))
    expect(view.getByRole('button', { name: 'Mine' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getAllByRole('listitem')).toHaveLength(1)
    expect(view.getByRole('listitem')).toHaveTextContent('Printer credit missing')

    await view.events.click(view.getByRole('button', { name: 'Unassigned' }))
    expect(view.getAllByRole('listitem')).toHaveLength(1)
    expect(view.getByRole('listitem')).toHaveTextContent('Laptop won’t join eduroam')

    await view.events.click(view.getByRole('button', { name: 'All' }))
    expect(view.getAllByRole('listitem')).toHaveLength(3)
  })

  it('opens the next and previous ticket with J and K, but not while typing', async () => {
    const view = renderQueue()

    await view.findAllByRole('listitem')

    const router = getTestRouter()
    const push = vi.spyOn(router, 'push').mockResolvedValue(undefined)

    await view.events.keyboard('j')
    expect(push).toHaveBeenLastCalledWith('/tickets/13')

    await view.events.keyboard('k')
    expect(push).toHaveBeenLastCalledWith('/tickets/11')

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    push.mockClear()

    await view.events.keyboard('j')
    expect(push).not.toHaveBeenCalled()

    input.remove()
  })

  it('moves on from a ticket that is not in the queue to the first one', async () => {
    currentTicketId.value = '99'

    const view = renderQueue()

    await view.findAllByRole('listitem')

    expect(queue.nextTicket.value?.number).toBe('886849')
    expect(queue.previousTicket.value).toBeNull()
  })

  it('is the last one at the end of the queue', async () => {
    currentTicketId.value = '13'

    const view = renderQueue()

    await view.findAllByRole('listitem')

    expect(queue.nextTicket.value).toBeNull()
    expect(queue.previousTicket.value?.number).toBe('886850')
  })

  it('collapses and remembers it', async () => {
    const view = renderQueue()

    await view.findAllByRole('listitem')
    await view.events.click(view.getByRole('button', { name: 'Hide the queue' }))

    expect(view.queryByRole('listitem')).not.toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Show the queue' })).toBeInTheDocument()
    expect(localStorage.getItem('studenthub-ticket-queue-collapsed')).toBe('true')

    await view.events.click(view.getByRole('button', { name: 'Show the queue' }))
    expect(await view.findAllByRole('listitem')).toHaveLength(3)
  })

  it('switches to another view', async () => {
    const view = renderQueue()

    await view.findAllByRole('listitem')
    await view.events.click(view.getByRole('button', { name: 'Choose the view of the queue' }))
    await view.events.click(await view.findByRole('button', { name: 'New Tickets' }))

    expect(view.getByRole('button', { name: 'Choose the view of the queue' })).toHaveTextContent(
      'New Tickets',
    )

    await waitFor(() => {
      const calls = getGraphQLMockCalls<TicketsCachedByOverviewQuery>(
        'query',
        'ticketsCachedByOverview',
      )
      expect(calls.some((call) => call.variables.overviewId === overviews[1].id)).toBe(true)
    })
  })
})
