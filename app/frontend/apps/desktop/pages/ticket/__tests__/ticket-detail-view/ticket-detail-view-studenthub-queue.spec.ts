// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getNode } from '@formkit/core'
import { waitFor, within } from '@testing-library/vue'
import { flushPromises } from '@vue/test-utils'

import { generateObjectData } from '#tests/graphql/builders/index.ts'
import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { visitView } from '#tests/support/components/visitView.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { mockFormUpdaterQuery } from '#shared/components/Form/graphql/queries/formUpdater.mocks.ts'
import {
  mockTicketUpdateMutation,
  waitForTicketUpdateMutationCalls,
} from '#shared/entities/ticket/graphql/mutations/update.mocks.ts'
import { mockTicketQuery } from '#shared/entities/ticket/graphql/queries/ticket.mocks.ts'
import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'
import { EnumOrderDirection } from '#shared/graphql/types.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import { mockOverviewsWithCachedCountQuery } from '#desktop/entities/ticket/graphql/queries/overviewsWithCachedCount.mocks.ts'
import { mockTicketsCachedByOverviewQuery } from '#desktop/entities/ticket/graphql/queries/ticketsCachedByOverview.mocks.ts'
import { mockUserCurrentTicketOverviewsQuery } from '#desktop/entities/ticket/graphql/queries/userCurrentTicketOverviews.mocks.ts'

// Student Hub: agents get the queue beside the ticket; a closed ticket moves on to the next one.

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
]

const ticket = createDummyTicket({
  state: {
    id: convertToGraphQLId('Ticket::State', 2),
    name: 'open',
    stateType: { id: convertToGraphQLId('TicketStateType', 2), name: 'open' },
  },
  defaultPolicy: { update: true, agentReadAccess: true },
})

const closedTicket = {
  ...ticket,
  state: {
    ...ticket.state,
    id: convertToGraphQLId('Ticket::State', 4),
    name: 'closed',
    stateType: {
      ...ticket.state.stateType,
      id: convertToGraphQLId('TicketStateType', 5),
      name: 'closed',
    },
  },
}

const mockQueue = () => {
  mockUserCurrentTicketOverviewsQuery({ userCurrentTicketOverviews: overviews })
  mockOverviewsWithCachedCountQuery({ ticketOverviews: overviews })
  mockTicketsCachedByOverviewQuery({
    ticketsCachedByOverview: generateObjectData('CachedTicketConnection', {
      totalCount: 2,
      edges: [
        {
          __typename: 'TicketEdge' as const,
          cursor: 'c1',
          node: createDummyTicket({
            ticketId: '1',
            number: '886850',
            title: 'Laptop won’t join eduroam',
          }),
        },
        {
          __typename: 'TicketEdge' as const,
          cursor: 'c2',
          node: createDummyTicket({
            ticketId: '2',
            number: '886851',
            title: 'Moodle quiz will not open',
          }),
        },
      ],
      pageInfo: { endCursor: 'MjU', hasNextPage: false },
    }),
  })
}

const mockForm = () =>
  mockFormUpdaterQuery({
    formUpdater: {
      fields: {
        group_id: { options: [{ value: 1, label: 'Users' }] },
        owner_id: { options: [{ value: 3, label: 'Test Admin Agent' }] },
        state_id: {
          options: [
            { value: 4, label: 'closed' },
            { value: 2, label: 'open' },
          ],
        },
        pending_time: { show: false },
        priority_id: { options: [{ value: 2, label: '2 normal' }] },
      },
      flags: { newArticlePresent: false },
    },
  })

describe('Ticket detail view: queue beside the ticket (Student Hub)', () => {
  beforeEach(() => {
    mockPermissions(['ticket.agent'])
    mockUserCurrent({ permissions: { names: ['ticket.agent'] } })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 404 })),
    )
    mockTicketQuery({ ticket })
    mockQueue()
    mockForm()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the queue with the open ticket marked, and the panels on the right', async () => {
    const view = await visitView('/tickets/1')

    const queue = await view.findByRole('complementary', { name: 'Ticket queue' })
    const rows = await within(queue).findAllByRole('listitem')

    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('aria-current', 'page')
    expect(await view.findByRole('navigation', { name: 'Ticket panels' })).toBeInTheDocument()
    expect(view.getByRole('complementary', { name: 'Content sidebar' })).toContainElement(
      view.getByRole('navigation', { name: 'Ticket panels' }),
    )
  })

  it('opens the next ticket of the queue after the ticket is closed', async () => {
    const view = await visitView('/tickets/1')

    await within(await view.findByRole('complementary', { name: 'Ticket queue' })).findAllByRole(
      'listitem',
    )
    await getNode('form-ticket-edit-1')?.settled

    mockTicketUpdateMutation({ ticketUpdate: { ticket: closedTicket } })

    await view.events.click(await view.findByRole('button', { name: 'Update' }))
    await waitForTicketUpdateMutationCalls()

    const router = getTestRouter()
    await waitFor(() => expect(router.currentRoute.value.path).toEqual('/tickets/2'))
  })

  it('stays on a ticket that is still open after Update', async () => {
    const view = await visitView('/tickets/1')

    await within(await view.findByRole('complementary', { name: 'Ticket queue' })).findAllByRole(
      'listitem',
    )
    await getNode('form-ticket-edit-1')?.settled

    mockTicketUpdateMutation({ ticketUpdate: { ticket } })

    await view.events.click(await view.findByRole('button', { name: 'Update' }))
    await waitForTicketUpdateMutationCalls()

    expect(await view.findByText('Ticket updated successfully.')).toBeInTheDocument()
    await flushPromises()
    expect(getTestRouter().currentRoute.value.path).toEqual('/tickets/1')
  })
})
