// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'

import StudenthubManagerDashboard from '../StudenthubManagerDashboard.vue'

mockRouterHooks()

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString()

const request = (ticketId: number, number: string, title: string, hours: number) => ({
  ticket_id: ticketId,
  number,
  title,
  reason: `Reason for ${title}`,
  requested_at: hoursAgo(hours),
  requested_by: 'Tom Barker',
  team: 'Service Desk',
  customer: 'Helen Ward',
  campus: 'UKBC Ilford',
  category: 'Hardware › Laptop',
  sla_paused: true,
  latest_message: {
    from: 'Helen Ward',
    created_at: hoursAgo(hours + 1),
    body: 'Could IT get a laptop ready?',
  },
})

const month = {
  decided: 17,
  median_wait_seconds: 13_200,
  longest_wait_seconds: 72_300,
  over_warning: 0,
  previous: { decided: 12, median_wait_seconds: 18_600 },
  per_week: [
    { week_start: '2026-09-07', approved: 2, denied: 0 },
    { week_start: '2026-09-14', approved: 3, denied: 1 },
    { week_start: '2026-09-21', approved: 3, denied: 0 },
    { week_start: '2026-09-28', approved: 3, denied: 1 },
    { week_start: '2026-10-05', approved: 3, denied: 1 },
  ],
  by_team: [
    { name: 'Service Desk', decided: 9, approved: 7 },
    { name: 'VLE', decided: 3, approved: 2 },
  ],
}

const dashboard = (requests: ReturnType<typeof request>[]) => ({
  waiting: {
    count: requests.length,
    oldest_requested_at: requests[0]?.requested_at ?? null,
    overdue: false,
    requests,
  },
  decisions: { approved: 14, denied: 3, approval_rate: 82 },
  month,
  still_open: {
    count: 1,
    tickets: [
      {
        ticket_id: 7,
        number: '886840',
        title: 'Replacement ID card',
        decided_at: hoursAgo(144),
        owner: 'Grace Mensah',
        state: 'open',
      },
    ],
  },
  recent: [
    {
      ticket_id: 8,
      number: '886841',
      title: 'Guest Wi-Fi for Open Day',
      state: 'approved',
      comment: 'Fine by me',
      decided_at: hoursAgo(20),
      requested_by: 'Leila Ahmed',
    },
  ],
  settings: { decisions_period_days: 30, waiting_warning_hours: 24, still_open_after_days: 3 },
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('StudenthubManagerDashboard', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  const stubFetch = (dashboards: ReturnType<typeof dashboard>[]) => {
    let call = 0
    fetchMock = vi.fn((url: string) => {
      if (url.includes('/approval/'))
        return Promise.resolve(json({ enabled: true, state: 'approved', history: [] }))
      // The manager's sites (none).
      if (url.includes('/manager_sites/')) return Promise.resolve(json({ sites: [] }))
      const body = dashboards[Math.min(call, dashboards.length - 1)]
      call += 1
      return Promise.resolve(json(body))
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  beforeEach(() => {
    mockUserCurrent({ firstname: 'Amira' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('opens the longest waiting request and lists the others', async () => {
    stubFetch([
      dashboard([
        request(1, '86412', 'Laptop for new starter', 26),
        request(2, '86397', 'CCTV footage', 2),
      ]),
    ])

    const view = renderComponent(StudenthubManagerDashboard, { router: true })

    const card = await view.findByTestId('manager-request')
    expect(
      within(card).getByRole('heading', { name: 'Laptop for new starter' }),
    ).toBeInTheDocument()
    expect(card).toHaveTextContent('Reason for Laptop for new starter')
    expect(card).toHaveTextContent('Could IT get a laptop ready?')
    expect(card).toHaveTextContent('over 24 h')
    expect(card).toHaveTextContent('1 of 2')

    const queue = view.getByTestId('manager-queue')
    expect(within(queue).getAllByRole('button')).toHaveLength(2)
    expect(within(queue).getByText('Over 24 h')).toBeInTheDocument()

    await view.events.click(within(queue).getByRole('button', { name: /CCTV footage/ }))

    expect(
      within(view.getByTestId('manager-request')).getByRole('heading', { name: 'CCTV footage' }),
    ).toBeInTheDocument()
  })

  it('needs a comment to deny, and opens the next request after a decision', async () => {
    stubFetch([
      dashboard([
        request(1, '86412', 'Laptop for new starter', 26),
        request(2, '86397', 'CCTV footage', 2),
      ]),
      dashboard([request(2, '86397', 'CCTV footage', 2)]),
    ])

    const view = renderComponent(StudenthubManagerDashboard, { router: true })
    const card = await view.findByTestId('manager-request')

    await view.events.click(within(card).getByRole('button', { name: 'Deny' }))

    expect(card).toHaveTextContent('Add a comment to deny the request.')
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/deny'), expect.anything())

    await view.events.click(within(card).getByRole('button', { name: 'Approve' }))

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tickets/1/approval/approve',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ comment: '' }) }),
    )
    expect(await view.findByRole('heading', { name: 'CCTV footage' })).toBeInTheDocument()
  })

  it('shows "All caught up" and the month in review when nothing waits', async () => {
    stubFetch([dashboard([])])

    const view = renderComponent(StudenthubManagerDashboard, { router: true })

    expect(await view.findByRole('heading', { name: 'Nothing to decide' })).toBeInTheDocument()
    expect(view.getByTestId('manager-all-caught-up')).toHaveTextContent('All caught up')
    expect(view.getByText('Your last decision').parentElement).toHaveTextContent(
      'Guest Wi-Fi for Open Day',
    )
    expect(view.queryByTestId('manager-request')).not.toBeInTheDocument()

    const review = view.getByTestId('manager-month')
    expect(review).toHaveTextContent('17')
    expect(review).toHaveTextContent('5 more than the 30 days before')
    expect(review).toHaveTextContent('82%')
    expect(review).toHaveTextContent('3 h 40')
    expect(review).toHaveTextContent('1 h 30 faster than before')
    expect(review).toHaveTextContent('None waited over 24 hours')
    expect(within(review).getByRole('img', { name: /Decisions per week/ })).toBeInTheDocument()
    expect(review).toHaveTextContent('Service Desk')

    const stillOpen = view.getByRole('region', { name: 'Back with teams, still open' })
    expect(within(stillOpen).getByRole('link', { name: /Replacement ID card/ })).toHaveAttribute(
      'href',
      '/desktop/tickets/7',
    )

    const recent = view.getByRole('region', { name: 'Recent decisions' })
    expect(recent).toHaveTextContent('Fine by me')
  })
})
