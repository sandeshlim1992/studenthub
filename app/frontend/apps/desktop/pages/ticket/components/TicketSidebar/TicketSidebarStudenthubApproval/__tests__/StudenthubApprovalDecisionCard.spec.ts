// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'

import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import StudenthubApprovalDecisionCard from '../StudenthubApprovalDecisionCard.vue'

import type { ApprovalRound, ApprovalStatus } from '../useTicketApproval.ts'

const status = ref<ApprovalStatus | null>(null)
const approve = vi.fn().mockResolvedValue(true)
const deny = vi.fn().mockResolvedValue(true)
const load = vi.fn()

vi.mock('../useTicketApproval.ts', () => ({
  useTicketApproval: () => ({
    status,
    isLoading: ref(false),
    isBusy: ref(false),
    errorMessage: ref(''),
    load,
    approve,
    deny,
    sendForApproval: vi.fn(),
    withdraw: vi.fn(),
  }),
}))

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({
    ticket: computed(() => ({ internalId: 42, updatedAt: '2026-10-05T09:00:00Z' })),
  }),
}))

const round = (fields: Partial<ApprovalRound> = {}): ApprovalRound => ({
  id: 7,
  state: 'pending',
  reason: 'Laptop is beyond repair',
  comment: null,
  requested_by: { id: 2, name: 'Test Agent' },
  approver: { id: 3, name: 'Test Manager' },
  decided_by: null,
  requested_at: '2026-10-05T08:00:00Z',
  decided_at: null,
  ...fields,
})

const setStatus = (current: ApprovalRound | null, canDecide = true) => {
  status.value = {
    enabled: true,
    state: current?.state === 'cancelled' ? null : (current?.state ?? null),
    current,
    history: [],
    can_request: false,
    can_cancel: false,
    can_decide: canDecide,
    managers: [],
  }
}

describe('StudenthubApprovalDecisionCard', () => {
  beforeEach(() => {
    mockUserCurrent({ id: convertToGraphQLId('User', 3), internalId: 3 })
    mockPermissions(['ticket.agent', 'ticket.approver'])
    mockApplicationConfig({ ticket_approval: true })
  })

  it('asks the manager the ticket was sent to, and approves with the comment', async () => {
    setStatus(round())

    const view = renderComponent(StudenthubApprovalDecisionCard, { form: true })

    expect(load).toHaveBeenCalled()

    const card = view.getByRole('article', { name: 'Approval request' })
    expect(card).toHaveTextContent('Test Agent asked you to approve this ticket')
    expect(card).toHaveTextContent('Laptop is beyond repair')

    await view.events.type(view.getByLabelText('Comment'), 'Fine by me')
    await view.events.click(view.getByRole('button', { name: 'Approve' }))

    expect(approve).toHaveBeenCalledWith('Fine by me')
  })

  it('stays hidden when the request is for another manager', () => {
    setStatus(round({ approver: { id: 9, name: 'Someone Else' } }))

    const view = renderComponent(StudenthubApprovalDecisionCard, { form: true })

    expect(view.queryByRole('article', { name: 'Approval request' })).not.toBeInTheDocument()
  })

  it('shows the result once decided', () => {
    setStatus(
      round({
        state: 'denied',
        comment: 'Use the spare one',
        decided_by: { id: 3, name: 'Test Manager' },
        decided_at: '2026-10-05T08:30:00Z',
      }),
      false,
    )

    const view = renderComponent(StudenthubApprovalDecisionCard, { form: true })

    const card = view.getByRole('article', { name: 'Approval request' })
    expect(card).toHaveTextContent('Denied by Test Manager')
    expect(card).toHaveTextContent('Use the spare one')
    expect(view.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
  })
})
