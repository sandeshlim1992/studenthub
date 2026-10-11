// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import TicketSubscribers, {
  type Props,
} from '../TicketSidebarInformationContent/TicketSubscribers.vue'

import '#tests/graphql/builders/mocks.ts'

const provideTestTicket = (subscribed: boolean = false) => {
  return createDummyTicket({
    subscribed,
    mentions: {
      __typename: 'MentionConnection',
      totalCount: 3,
      edges: [
        {
          cursor: 'AA',
          node: {
            __typename: 'Mention',
            user: {
              __typename: 'User',
              id: convertToGraphQLId('User', 2),
              internalId: 2,
              firstname: 'John',
              lastname: 'Doe',
              fullname: 'John Doe',
              active: true,
            },
            userTicketAccess: {
              agentReadAccess: true,
            },
          },
        },
        {
          cursor: 'AB',
          node: {
            __typename: 'Mention',
            user: {
              __typename: 'User',
              id: convertToGraphQLId('User', 3),
              internalId: 3,
              firstname: 'Jane',
              lastname: 'Doe',
              fullname: 'Jane Doe',
              active: true,
            },
            userTicketAccess: {
              agentReadAccess: true,
            },
          },
        },
        {
          cursor: 'AC',
          node: {
            __typename: 'Mention',
            user: {
              __typename: 'User',
              id: convertToGraphQLId('User', 4),
              internalId: 4,
              firstname: 'Jim',
              lastname: 'Doe',
              fullname: 'Jim Doe',
              active: false,
            },
            userTicketAccess: {
              agentReadAccess: true,
            },
          },
        },
      ],
    },
  })
}

const renderTicketSubscribers = (props: Partial<Props> = {}) =>
  renderComponent(TicketSubscribers, {
    props: {
      ticket: provideTestTicket(),
      ...props,
    },
    router: true,
    form: true,
  })

describe('TicketSubscribers', () => {
  // Student Hub: a list of contributors only, without the "Subscribe me" toggle.
  it('has no toggle to subscribe', () => {
    const wrapper = renderTicketSubscribers({ ticket: provideTestTicket(true) })

    expect(wrapper.queryByLabelText('Subscribe me')).not.toBeInTheDocument()
  })

  it('says so when nobody contributes yet', () => {
    const wrapper = renderTicketSubscribers({
      ticket: createDummyTicket({
        mentions: { __typename: 'MentionConnection', totalCount: 0, edges: [] },
      }),
    })

    expect(wrapper.getByText('No contributors yet.')).toBeInTheDocument()
    expect(wrapper.queryByRole('list')).not.toBeInTheDocument()
  })

  it('renders a list of subscribers', () => {
    const wrapper = renderTicketSubscribers()

    expect(wrapper.getByLabelText('Avatar (John Doe)')).toBeInTheDocument()
    expect(wrapper.getByLabelText('Avatar (Jane Doe)')).toBeInTheDocument()

    // Inactive users should not be rendered
    expect(wrapper.queryByLabelText('Avatar (Jim Doe)')).not.toBeInTheDocument()
  })

  it('shows the full name of each subscriber', () => {
    const wrapper = renderTicketSubscribers()

    const items = wrapper.getAllByRole('listitem')

    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent('John Doe')
    expect(items[1]).toHaveTextContent('Jane Doe')
  })

  it('shows popover with user details on hover', async () => {
    mockUserCurrent({
      permissions: {
        names: ['ticket.agent'],
      },
    })
    const wrapper = renderTicketSubscribers()

    await wrapper.events.hover(wrapper.getByLabelText('Avatar (John Doe)'))

    // popover
    expect(await wrapper.findByRole('region')).toBeVisible()
  })
})
