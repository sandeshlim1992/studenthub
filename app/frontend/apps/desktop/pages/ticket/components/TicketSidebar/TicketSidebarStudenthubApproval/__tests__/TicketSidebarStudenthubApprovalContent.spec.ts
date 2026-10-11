// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getAllByRole, getByRole, waitFor } from '@testing-library/vue'
import { reactive } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import { TicketSidebarScreenType } from '#desktop/pages/ticket/types/sidebar.ts'

import approvalSidebarPlugin from '../../plugins/studenthub-approval.ts'
import TicketSidebarStudenthubApprovalContent from '../TicketSidebarStudenthubApprovalContent.vue'

import type { ApprovalRound, ApprovalStatus } from '../useTicketApproval.ts'

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

const pendingRound: ApprovalRound = {
  id: 7,
  state: 'pending',
  reason: 'Laptop is beyond repair',
  comment: null,
  requested_by: { id: 2, name: 'Test Agent' },
  approver: { id: 3, name: 'Test Manager' },
  decided_by: null,
  requested_at: '2026-10-04T09:00:00Z',
  decided_at: null,
  sla_paused: true,
  team: 'Service Desk',
}

const renderApproval = async (
  status: Partial<ApprovalStatus>,
  extra: Record<string, unknown> = {},
) => {
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
      context: {
        screenType: TicketSidebarScreenType.TicketDetailView,
        formValues: {},
        view: 'agent',
      },
      approval,
    },
    router: true,
    form: true,
  })

  await waitForNextTick()

  return { view, approval }
}

// The first line of each step in the timeline, newest first.
const timeline = (view: Awaited<ReturnType<typeof renderApproval>>['view']) =>
  getAllByRole(view.getByRole('list', { name: 'Requests and decisions' }), 'listitem').map((item) =>
    item.querySelector('p')?.textContent?.trim(),
  )

describe('TicketSidebarStudenthubApprovalContent.vue', () => {
  it('lets the manager approve with a comment', async () => {
    const { view, approval } = await renderApproval({
      state: 'pending',
      current: pendingRound,
      history: [pendingRound],
      can_decide: true,
    })

    expect(view.getAllByText('Your decision')).toHaveLength(2)
    expect(timeline(view)).toEqual(['Your decision', 'Test Agent sent it to Test Manager'])
    expect(view.getByText('Laptop is beyond repair')).toBeInTheDocument()
    expect(view.getByText('Service Desk', { exact: false })).toBeInTheDocument()

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

  it('shows the agent who asked who has the ticket, and Withdraw', async () => {
    const { view } = await renderApproval({
      state: 'pending',
      current: pendingRound,
      history: [pendingRound],
      can_cancel: true,
    })

    expect(view.getByText(/^Waiting · \d+ (min|h|d)$/)).toBeInTheDocument()
    expect(timeline(view)).toEqual([
      'Waiting for Test Manager',
      'Test Agent sent it to Test Manager',
    ])
    expect(
      view.getByText('Only Test Manager and Test Agent can open the ticket. Its SLA is paused.'),
    ).toBeInTheDocument()
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

    expect(view.getByText('Not sent')).toBeInTheDocument()
    expect(view.getByText(/^No requests yet\./)).toBeInTheDocument()

    await view.events.click(view.getByLabelText('Manager'))
    const dropdown = view.getByRole('menu')
    const options = getAllByRole(dropdown, 'option')

    // Every manager, whatever the team.
    expect(options.map((option) => option.textContent?.trim())).toEqual([
      'Test Manager',
      'Other Manager',
    ])

    await view.events.click(getByRole(dropdown, 'option', { name: 'Test Manager' }))
    await view.events.type(view.getByLabelText('Reason'), 'Needs a new laptop')
    await view.events.click(view.getByRole('button', { name: 'Send for approval' }))

    await waitFor(() =>
      expect(approval.sendForApproval).toHaveBeenCalledWith(3, 'Needs a new laptop'),
    )
  })

  it('explains when there are no managers', async () => {
    const { view } = await renderApproval({ can_request: true, managers: [] })

    expect(
      view.getByText('There are no managers yet. Give someone the Managers role first.'),
    ).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Send for approval' })).not.toBeInTheDocument()
  })

  it('shows errors from the server', async () => {
    const { view } = await renderApproval(
      {},
      { errorMessage: 'Please say why the request is denied.' },
    )

    expect(view.getByText('Please say why the request is denied.')).toBeInTheDocument()
  })

  it('lists every request and decision, newest first', async () => {
    const { view } = await renderApproval({
      state: 'denied',
      can_request: true,
      managers: [{ id: 3, name: 'Test Manager' }],
      history: [
        {
          ...pendingRound,
          id: 8,
          state: 'denied',
          comment: 'No budget left',
          decided_by: { id: 3, name: 'Test Manager' },
          decided_at: '2026-10-04T10:00:00Z',
        },
        {
          ...pendingRound,
          id: 6,
          state: 'cancelled',
          reason: 'Old laptop is slow',
          decided_by: { id: 2, name: 'Test Agent' },
          requested_at: '2026-10-02T09:00:00Z',
          decided_at: '2026-10-02T11:00:00Z',
        },
      ],
    })

    expect(view.getByText('Denied')).toBeInTheDocument()
    expect(timeline(view)).toEqual([
      'Denied by Test Manager',
      'Test Agent sent it to Test Manager',
      'Withdrawn by Test Agent',
      'Test Agent sent it to Test Manager',
    ])
    expect(view.getByText('No budget left')).toBeInTheDocument()
    expect(view.getByText('Old laptop is slow')).toBeInTheDocument()

    // Sending again is a button; the form only opens on request.
    expect(view.queryByLabelText('Reason')).not.toBeInTheDocument()
    await view.events.click(view.getByRole('button', { name: 'Send for approval again' }))
    expect(view.getByLabelText('Reason')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Cancel' }))
    expect(view.queryByLabelText('Reason')).not.toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Send for approval again' })).toBeInTheDocument()
  })

  it('says when the last request was withdrawn', async () => {
    const { view } = await renderApproval({
      history: [
        {
          ...pendingRound,
          state: 'cancelled',
          decided_by: { id: 2, name: 'Test Agent' },
          decided_at: '2026-10-04T10:00:00Z',
        },
      ],
    })

    expect(view.getByText('Withdrawn')).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Send for approval again' })).not.toBeInTheDocument()
  })
})
