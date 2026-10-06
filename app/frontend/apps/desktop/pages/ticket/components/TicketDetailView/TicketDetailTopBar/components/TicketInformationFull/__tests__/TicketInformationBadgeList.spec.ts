// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { createDummyTicket } from '#shared/entities/ticket-article/__tests__/mocks/ticket.ts'
import type { Ticket } from '#shared/graphql/types.ts'

import TicketInformationBadgeList from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/TicketInformationFull/TicketInformationBadgeList.vue'
import { mockTicketChecklistQuery } from '#desktop/pages/ticket/graphql/queries/ticketChecklist.mocks.ts'

let ticket: Ticket

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({
    ticketInternalId: ref(ticket.internalId),
    ticketId: computed(() => ticket.id),
    ticket: computed(() => ticket),
    isTicketEditable: computed(() => !!ticket?.policy.update),
  }),
}))

vi.mock('#desktop/pages/ticket/composables/useTicketSidebar.ts', () => ({
  useTicketSidebar: () => ({}),
}))

vi.hoisted(() => {
  vi.setSystemTime(new Date('2024-11-11T11:11:11Z'))
})

describe('TicketInformationBadgeList', () => {
  beforeEach(() => {
    mockTicketChecklistQuery({
      ticketChecklist: null,
    })
  })

  // Student Hub: state and priority moved next to the title (TopBarHeaderFull), "Created" is plain text.
  it('do not display the ticket priority if user has no agent permissions', () => {
    ticket = createDummyTicket({ defaultPolicy: { update: false, agentReadAccess: false } })

    const wrapper = renderComponent(TicketInformationBadgeList, {})

    expect(wrapper.queryByText(ticket.priority.name)).not.toBeInTheDocument()
  })

  it('displays when the ticket was created', () => {
    ticket = createDummyTicket()
    const wrapper = renderComponent(TicketInformationBadgeList, {})

    expect(wrapper.container).toHaveTextContent('Created13 years ago')
  })
})
