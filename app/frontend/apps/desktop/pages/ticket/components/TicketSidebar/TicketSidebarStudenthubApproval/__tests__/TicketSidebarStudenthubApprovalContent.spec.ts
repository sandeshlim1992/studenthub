// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getAllByRole, getByRole, waitFor } from '@testing-library/vue'
import { reactive } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import { TicketSidebarScreenType } from '#desktop/pages/ticket/types/sidebar.ts'

import approvalSidebarPlugin from '../../plugins/studenthub-approval.ts'
import TicketSidebarStudenthubApprovalContent from '../TicketSidebarStudenthubApprovalContent.vue'

import type { ApprovalStatus } from '../useTicketApproval.ts'

mockRouterHooks()

const baseStatus: ApprovalStatus = {
  enabled: true,
  state: null,
  current: null,
  history: [],
  can_request: false,
  can_cancel: false,
  can_decide: false,
  managers: [],
}

const pendingRound = {
  id: 7,
  state: 'pending' as const,
  reason: 'Laptop is beyond repair',
  comment: null,
  requested_by: { id: 2, name: 'Test Agent' },
  approver: { id: 3, name: 'Test Manager' },
  decided_by: null,
  requested_at: '2026-10-04T09:00:00Z',
  decided_at: null,
}

const renderApproval = async (status: Partial<ApprovalStatus>, extra: Record<string, unknown> = {}) => {
  const approval = reactive({
    status: { ...baseStatus, ...status },
    isLoading: false,
    isBusy: false,
    errorMessage: '',
    load: vi.fn(),
    sendForApproval: vi.fn().mockResolvedValue(true),
    approve: vi.fn().mockResolvedValue(true),
    deny: vi.fn().mockResolvedValue(true),
    withdraw: vi.fn().mockResolvedValue(true),
    ...extra,
  })

  const view = renderComponent(TicketSidebarStudenthubApprovalContent, {
    props: {
      sidebarPlugin: approvalSidebarPlugin,
      modelValue: {},
      context: { screenType: TicketSidebarScreenType.TicketDetailView, formValues: {}, view: 'agent' },
      approval,
    },
    router: true,
    form: true,
  })

  await waitForNextTick()

  return { view, approval }
}

describe('TicketSidebarStudenthubApprovalContent.vue', () => {
  it('lets the manager approve with a comment', async () => {
    const { view, approval } = await renderApproval({
      state: 'pending',
      current: pendingRound,
      can_decide: true,
    })

    expect(view.getByText('Waiting for approval')).toBeInTheDocument()
    expect(view.getByText('Laptop is beyond repair')).toBeInTheDocument()
    expect(view.getByText('Test Agent', { exact: false })).toBeInTheDocument()

    await view.events.type(view.getByLabelText('Comment'), 'Go ahead')
    await view.events.click(view.getByRole('button', { name: 'Approve' }))

    await waitFor(() => expect(approval.approve).toHaveBeenCalledWith('Go ahead'))
  })

  it('lets the manager deny', async () => {
    const { view, approval } = await renderApproval({
      state: 'pending',
      current: pendingRound,
      can_decide: true,
    })

    await view.events.type(view.getByLabelText('Comment'), 'No budget left')
    await view.events.click(view.getByRole('button', { name: 'Deny' }))

    await waitFor(() => expect(approval.deny).toHaveBeenCalledWith('No budget left'))
  })

  it('shows no decision buttons to the agent who asked', async () => {
    const { view } = await renderApproval({
      state: 'pending',
      current: pendingRound,
      can_cancel: true,
    })

    expect(view.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Withdraw request' })).toBeInTheDocument()
  })

  it('sends the ticket to the chosen manager', async () => {
    const { view, approval } = await renderApproval({
      can_request: true,
      managers: [
        { id: 3, name: 'Test Manager' },
        { id: 4, name: 'Other Manager' },
      ],
    })

    await view.events.click(view.getByLabelText('Manager'))
    const dropdown = view.getByRole('menu')
    const options = getAllByRole(dropdown, 'option')

    // Every manager, whatever the team.
    expect(options.map((option) => option.textContent?.trim())).toEqual(['Test Manager', 'Other Manager'])

    await view.events.click(getByRole(dropdown, 'option', { name: 'Test Manager' }))
    await view.events.type(view.getByLabelText('Reason'), 'Needs a new laptop')
    await view.events.click(view.getByRole('button', { name: 'Send for approval' }))

    await waitFor(() => expect(approval.sendForApproval).toHaveBeenCalledWith(3, 'Needs a new laptop'))
  })

  it('explains when there are no managers', async () => {
    const { view } = await renderApproval({ can_request: true, managers: [] })

    expect(view.getByText('There are no managers yet. Give someone the Managers role first.')).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Send for approval' })).not.toBeInTheDocument()
  })

  it('shows errors from the server', async () => {
    const { view } = await renderApproval({}, { errorMessage: 'Please say why the request is denied.' })

    expect(view.getByText('Please say why the request is denied.')).toBeInTheDocument()
  })

  it('lists earlier rounds', async () => {
    const { view } = await renderApproval({
      state: 'denied',
      can_request: true,
      managers: [{ id: 3, name: 'Test Manager' }],
      history: [
        { ...pendingRound, id: 8, state: 'denied', comment: 'No budget left', decided_at: '2026-10-04T10:00:00Z' },
      ],
    })

    expect(view.getByText('History')).toBeInTheDocument()
    expect(view.getByText('No budget left')).toBeInTheDocument()
    expect(view.getByText('You can send it for approval again.')).toBeInTheDocument()
  })
})
