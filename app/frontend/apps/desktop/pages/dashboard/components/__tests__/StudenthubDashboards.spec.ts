// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { mockRouterHooks } from '#tests/support/mock-vue-router.ts'

import StudenthubAdminDashboard from '../StudenthubAdminDashboard.vue'
import StudenthubAgentDashboard from '../StudenthubAgentDashboard.vue'

mockRouterHooks()

const activity = {
  items: [
    {
      id: 1,
      action: 'replied',
      ticket: { id: 7004, number: '886844', title: 'New starter laptop request' },
      actor: { id: 5, name: 'Priya Shah' },
      created_at: '2026-10-07T10:00:00Z',
    },
    {
      id: 2,
      action: 'updated',
      ticket: { id: 7005, number: '886812', title: 'Exam timetable clash' },
      actor: { id: null, name: null },
      created_at: '2026-10-07T09:00:00Z',
    },
  ],
}

const unassigned = {
  teams: [
    {
      id: 26,
      name: 'Service Desk',
      count: 5,
      overdue: 2,
      oldest: [
        {
          id: 7010,
          number: '886850',
          title: 'Wi-Fi in the library',
          created_at: '2026-10-05T09:00:00Z',
        },
        {
          id: 7011,
          number: '886851',
          title: 'Moodle login fails',
          created_at: '2026-10-06T09:00:00Z',
        },
        { id: 7012, number: '886852', title: 'Password reset', created_at: '2026-10-07T09:00:00Z' },
      ],
      view_link: 'studenthub_team_26',
    },
    { id: 27, name: 'VLE', count: 0, overdue: 0, oldest: [], view_link: 'studenthub_team_27' },
  ],
}

const agentStats = {
  StatsTicketWaitingTime: { handling_time: 18, average_per_agent: 24, state: 'good' },
  StatsTicketEscalation: { own: 2, total: 9, state: 'good', average_per_agent: '-' },
  StatsTicketChannelDistribution: {
    channels: {
      email: { inbound: 100, outbound: 24 },
      phone: { inbound: 50, outbound: 8 },
      web: { inbound: 32, outbound: 0 },
    },
  },
  StatsTicketLoadMeasure: { own: 31, total: 142, average_per_agent: 24 },
  StatsTicketInProcess: { in_process: 21, percent: 68, total: 31, average_per_agent: 61 },
  StatsTicketReopen: { count: 3, percent: 4, total: 76, average_per_agent: 6 },
}

const overview = {
  open: {
    total: 21,
    created_today: 3,
    closed_today: 1,
    teams: [
      {
        id: 26,
        name: 'Service Desk',
        count: 15,
        waiting_for_approval: false,
        view_link: 'studenthub_team_26',
      },
      { id: 34, name: 'Managers', count: 2, waiting_for_approval: true, view_link: null },
    ],
  },
  sla: { overdue: 9, due_soon: 1, on_track: 3, none: 8 },
  unassigned: { count: 8, oldest_created_at: '2026-06-03T13:38:34Z' },
  trend: [
    { date: '2026-10-01', created: 4, closed: 2 },
    { date: '2026-10-02', created: 14, closed: 9 },
    { date: '2026-10-03', created: 1, closed: 0 },
    { date: '2026-10-04', created: 8, closed: 6 },
    { date: '2026-10-05', created: 1, closed: 3 },
    { date: '2026-10-06', created: 0, closed: 2 },
    { date: '2026-10-07', created: 7, closed: 1 },
  ],
  sites: {
    list: [
      { id: 7, name: 'FSB', count: 18, view_link: 'studenthub_institution_7' },
      { id: 8, name: 'LSST', count: 0, view_link: null },
    ],
    without_site: 3,
  },
  channels: [
    { key: 'email', count: 135 },
    { key: 'phone', count: 160 },
    { key: 'web', count: 34 },
    { key: 'other', count: 7 },
  ],
  agents: { online: 1, total: 35 },
  approvals: null,
  rating: { count: 1, average: 4.0 },
  settings: { trend_days: 7, channel_days: 30, rating_days: 30, escalation_warning_minutes: 60 },
}

const mockServer = (routes: Record<string, unknown>) => {
  const calls: string[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url)
      if (!(url in routes)) return new Response('{}', { status: 404 })
      return new Response(JSON.stringify(routes[url]))
    }),
  )
  return calls
}

describe('Student Hub dashboards', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Sandesh' })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('Briefing (agents)', () => {
    it('sums up the day and compares the agent with the team', async () => {
      mockServer({
        '/api/v1/signshow': { collections: { StatsStore: [{ data: agentStats }] } },
        '/api/v1/studenthub/dashboard/activity': activity,
        '/api/v1/studenthub/dashboard/unassigned': unassigned,
      })

      const view = renderComponent(StudenthubAgentDashboard, { router: true, store: true })

      expect(
        await view.findByText(
          '2 of your 31 open tickets are escalated. Students waited 18 min for you today, 6 min less than the team.',
        ),
      ).toBeInTheDocument()
      expect(view.getByRole('heading', { level: 1 })).toHaveTextContent('Sandesh')

      expect(
        within(view.getByRole('region', { name: 'Waiting time today' })).getByText('6 min faster'),
      ).toBeInTheDocument()
      expect(
        within(view.getByRole('region', { name: 'Escalations' })).getByText('Mood: Good'),
      ).toBeInTheDocument()
      expect(
        within(view.getByRole('region', { name: 'Reopened by students' })).getByText(
          'Below average',
        ),
      ).toBeInTheDocument()

      const workload = view.getByRole('region', { name: 'Your workload' })
      expect(workload).toHaveTextContent('31of 142 open')
      expect(within(workload).getByRole('img')).toHaveAccessibleName(
        'Email 124, Phone 58, Web / Portal 32',
      )

      const feed = view.getByRole('region', { name: 'Activity' })
      expect(feed).toHaveTextContent('Priya Shah replied to #886844 New starter laptop request')
      expect(feed).toHaveTextContent('System updated #886812')
      expect(within(feed).getByRole('link', { name: '#886844' })).toHaveAttribute(
        'href',
        '/desktop/tickets/7004',
      )
    })

    it('shows the unassigned tickets of each of the agent’s teams', async () => {
      mockServer({
        '/api/v1/signshow': { collections: { StatsStore: [{ data: agentStats }] } },
        '/api/v1/studenthub/dashboard/activity': activity,
        '/api/v1/studenthub/dashboard/unassigned': unassigned,
      })

      const view = renderComponent(StudenthubAgentDashboard, { router: true, store: true })

      const section = await view.findByRole('region', { name: 'Unassigned in your teams' })
      const desk = await within(section).findByRole('region', { name: 'Service Desk' })
      expect(desk).toHaveTextContent('5unassigned')
      expect(desk).toHaveTextContent('2 overdue')
      expect(desk).toHaveTextContent('2 more waiting')
      expect(within(desk).getByRole('link', { name: '#886850' })).toHaveAttribute(
        'href',
        '/desktop/tickets/7010',
      )
      expect(within(desk).getByRole('link', { name: 'View team →' })).toHaveAttribute(
        'href',
        '/desktop/tickets/view/studenthub_team_26',
      )

      const vle = within(section).getByRole('region', { name: 'VLE' })
      expect(vle).toHaveTextContent('All assigned')
      expect(within(vle).queryByRole('listitem')).not.toBeInTheDocument()
    })

    it('speaks of one ticket in the singular', async () => {
      mockServer({
        '/api/v1/signshow': {
          collections: {
            StatsStore: [
              {
                data: {
                  StatsTicketLoadMeasure: { own: 1, total: 25 },
                  StatsTicketReopen: { count: 0, percent: 0, total: 0, average_per_agent: 3.6 },
                },
              },
            ],
          },
        },
        '/api/v1/studenthub/dashboard/activity': { items: [] },
      })

      const view = renderComponent(StudenthubAgentDashboard, { router: true, store: true })

      expect(await view.findByText('Your one open ticket is not escalated.')).toBeInTheDocument()
      expect(
        view.getByText('No student has waited for a reply from you today.'),
      ).toBeInTheDocument()
      expect(
        within(view.getByRole('region', { name: 'Reopened by students' })).queryByText(
          'Below average',
        ),
      ).not.toBeInTheDocument()
    })

    it('says so when nothing is assigned', async () => {
      mockServer({
        '/api/v1/signshow': { collections: { StatsStore: [{ data: {} }] } },
        '/api/v1/studenthub/dashboard/activity': { items: [] },
      })

      const view = renderComponent(StudenthubAgentDashboard, { router: true, store: true })

      expect(await view.findByText('You have no open tickets assigned.')).toBeInTheDocument()
      expect(view.getByText('No ticket activity yet.')).toBeInTheDocument()
      expect(
        await view.findByText('The unassigned tickets could not be loaded. Try Refresh.'),
      ).toBeInTheDocument()
    })
  })

  describe('Team overview (admins)', () => {
    it('shows the open tickets by team, deadlines, people, trend, sites, channels and rating', async () => {
      mockServer({
        '/api/v1/studenthub/dashboard/overview': overview,
        '/api/v1/studenthub/dashboard/activity': activity,
      })

      const view = renderComponent(StudenthubAdminDashboard, { router: true, store: true })

      expect(
        await view.findByText(
          '21 open tickets across the teams: 9 past their SLA deadline, 8 without an agent.',
        ),
      ).toBeInTheDocument()

      const open = view.getByRole('region', { name: 'Open tickets' })
      expect(within(open).getByRole('link', { name: 'Service Desk' })).toHaveAttribute(
        'href',
        '/desktop/tickets/view/studenthub_team_26',
      )
      expect(open).toHaveTextContent('Waiting for approval2')
      expect(open).toHaveTextContent('3 new today · 1 closed today')

      expect(
        within(view.getByRole('region', { name: 'SLA deadlines' })).getByText('Needs attention'),
      ).toBeInTheDocument()
      expect(view.getByRole('region', { name: 'Without an agent' })).toHaveTextContent('8')
      expect(view.getByRole('region', { name: 'Agents online' })).toHaveTextContent('1of 35')

      const trend = within(view.getByRole('region', { name: 'New and closed tickets' })).getByRole(
        'img',
      )
      expect(trend.getAttribute('aria-label')).toMatch(/14 new, 9 closed/)

      const sites = view.getByRole('region', { name: 'Sites' })
      expect(within(sites).getByRole('link', { name: 'FSB' })).toHaveAttribute(
        'href',
        '/desktop/tickets/view/studenthub_institution_7',
      )
      expect(sites).toHaveTextContent('Without a site: 3')

      expect(view.getByRole('region', { name: 'How tickets came in' })).toHaveTextContent(
        'Phone 160(48%)',
      )
      expect(view.getByRole('region', { name: 'Student rating' })).toHaveTextContent('4/ 5')
      expect(view.queryByRole('region', { name: 'Waiting for approval' })).not.toBeInTheDocument()
    })

    it('explains when the figures cannot be loaded', async () => {
      mockServer({ '/api/v1/studenthub/dashboard/activity': { items: [] } })

      const view = renderComponent(StudenthubAdminDashboard, { router: true, store: true })

      expect(
        await view.findByText('The dashboard could not be loaded. Try Refresh.'),
      ).toBeInTheDocument()
    })
  })
})
