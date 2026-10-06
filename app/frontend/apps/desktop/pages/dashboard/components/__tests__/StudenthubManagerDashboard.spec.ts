// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'

import StudenthubManagerDashboard from '../StudenthubManagerDashboard.vue'

mockRouterHooks()

const dashboard = {
  waiting: { count: 2, oldest_requested_at: '2026-10-03T09:00:00Z', overdue: true },
  decisions: { approved: 3, denied: 1, approval_rate: 75 },
  still_open: {
    count: 1,
    tickets: [
      { ticket_id: 7, number: '886840', title: 'Replacement laptop', decided_at: '2026-10-01T09:00:00Z', owner: 'Test Agent' },
    ],
  },
  recent: [
    {
      ticket_id: 7,
      number: '886840',
      title: 'Replacement laptop',
      state: 'approved',
      comment: 'Fine by me',
      decided_at: '2026-10-01T09:00:00Z',
      requested_by: 'Test Agent',
    },
  ],
  settings: { decisions_period_days: 30, waiting_warning_hours: 24, still_open_after_days: 3 },
}

describe('StudenthubManagerDashboard', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Waliul' })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(dashboard), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      ),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the manager's approvals", async () => {
    const view = renderComponent(StudenthubManagerDashboard, { router: true })

    expect(await view.findByText('Welcome back, Waliul')).toBeInTheDocument()

    const waiting = await view.findByRole('region', { name: 'Waiting for you' })
    expect(within(waiting).getByTestId('manager-waiting-count')).toHaveTextContent('2')
    expect(waiting).toHaveTextContent('Waiting over 24 hours')

    const decisions = view.getByRole('region', { name: 'Your decisions' })
    expect(decisions).toHaveTextContent('75%')
    expect(decisions).toHaveTextContent('Approved3')

    const stillOpen = view.getByRole('region', { name: 'Approved but still open' })
    expect(within(stillOpen).getByRole('link', { name: /Replacement laptop/ })).toHaveAttribute('href', '/desktop/tickets/7')

    const recent = view.getByRole('region', { name: 'Your recent decisions' })
    expect(recent).toHaveTextContent('Fine by me')
    expect(recent).toHaveTextContent('asked by Test Agent')

    expect(view.queryByRole('button', { name: /New Ticket/ })).not.toBeInTheDocument()
    expect(view.queryByText('Activity Stream')).not.toBeInTheDocument()
  })
})
