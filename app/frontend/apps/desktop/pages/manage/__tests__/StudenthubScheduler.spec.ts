// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import Scheduler from '../views/Scheduler.vue'
import SchedulerJob from '../views/SchedulerJob.vue'

import type { AutomationOptions } from '../components/Automation/automation.ts'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForVariantConfirmation: mockWaitForVariantConfirmation }),
}))

const options: AutomationOptions = {
  states: [
    { id: 3, name: 'pending reminder', active: true },
    { id: 4, name: 'closed', active: true },
    { id: 9, name: 'Resolved', active: true },
  ],
  priorities: [{ id: 2, name: 'P3 - Normal', active: true }],
  groups: [{ id: 26, name: 'Service Desk', active: true }],
  agents: [{ id: 7, name: 'Test Agent', active: true }],
  organizations: [],
  webhooks: [{ id: 16, name: 'Survey', active: true }],
  ticket_attributes: [],
}

const userOptions: AutomationOptions = {
  ...options,
  roles: [{ id: 3, name: 'Customer', active: true }],
  attributes: {
    user: [
      { name: 'email', display: 'Email', data_type: 'input', active: true, options: [] },
      { name: 'active', display: 'Active', data_type: 'active', active: true, options: [] },
    ],
    organization: [
      { name: 'shared', display: 'Shared organization', data_type: 'boolean', active: true, options: [] },
    ],
  },
}

const everyTenMinutes = {
  days: { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
  hours: { '9': true, '10': true, '11': true },
  minutes: { '0': true, '10': true, '20': true, '30': true, '40': true, '50': true },
}

const job = {
  id: 10,
  name: 'Change Resolved ticket to Closed',
  note: 'From the test server',
  active: true,
  object: 'Ticket',
  disable_notification: true,
  timeplan: everyTenMinutes,
  condition: {
    'ticket.state_id': { operator: 'is', value: ['9'] },
    'ticket.updated_at': { operator: 'before (relative)', value: '1', range: 'day' },
  },
  perform: {
    'ticket.state_id': { value: '4' },
    'notification.webhook': { webhook_id: '16' },
  },
  last_run_at: '2026-10-07T09:00:00Z',
  next_run_at: '2026-10-07T09:10:00Z',
  matching: 0,
}

type Reply = { status?: number; body: unknown }

const mockServer = (routes: Record<string, (body?: unknown) => Reply>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ method, url, body })
      const handler = routes[`${method} ${url}`]
      const reply = handler ? handler(body) : { status: 404, body: { error: `No mock for ${method} ${url}` } }
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
    }),
  )
  return calls
}

const routes = [
  { path: '/', name: 'Home', component: { template: '<div />' } },
  { path: '/manage/scheduler', name: 'ManageScheduler', component: { template: '<div />' } },
  { path: '/manage/scheduler/:jobId(\\d+|new)', name: 'ManageSchedulerJob', component: { template: '<div />' } },
]

const renderView = async (component: typeof Scheduler, path: string) => {
  const view = renderComponent(component, {
    router: true,
    routerRoutes: routes,
    store: true,
    // Zammad's layout expects a router view around it; the page content is what's tested here.
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })
  await view.router.push(path)
  return view
}

describe('Scheduler', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('list', () => {
    it('shows each job with when it runs, and switches it off', async () => {
      const calls = mockServer({
        'GET /api/v1/jobs': () => ({ body: [job] }),
        'PUT /api/v1/jobs/10': () => ({ body: { ...job, active: false } }),
      })

      const view = await renderView(Scheduler, '/manage/scheduler')

      const row = (await view.findByRole('link', { name: job.name })).closest('tr')!
      expect(row).toHaveTextContent('Mon–Fri, every 10 minutes, 09h–11h')
      expect(row).toHaveTextContent('From the test server')

      await view.events.click(within(row).getByRole('switch', { name: `Active: ${job.name}` }))

      await vi.waitFor(() => expect(within(row).getByRole('switch')).toHaveAttribute('aria-checked', 'false'))
      expect(calls.find((call) => call.method === 'PUT')?.body).toEqual({ active: false })
    })

    it('deletes a job after asking', async () => {
      const calls = mockServer({
        'GET /api/v1/jobs': () => ({ body: [job] }),
        'DELETE /api/v1/jobs/10': () => ({ body: {} }),
      })

      const view = await renderView(Scheduler, '/manage/scheduler')
      await view.events.click(await view.findByRole('button', { name: `Delete ${job.name}` }))

      expect(mockWaitForVariantConfirmation).toHaveBeenCalledWith('delete')
      await vi.waitFor(() => expect(view.queryByRole('link', { name: job.name })).not.toBeInTheDocument())
      expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
    })
  })

  describe('editor', () => {
    it('shows a job and saves it unchanged except for what was edited', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/automation/options': () => ({ body: options }),
        'GET /api/v1/jobs/10': () => ({ body: job }),
        'POST /api/v1/tickets/selector': () => ({ body: { object_count: 3 } }),
        'PUT /api/v1/jobs/10': () => ({ body: job }),
      })

      const view = await renderView(SchedulerJob, '/manage/scheduler/10')

      const name = await view.findByLabelText('Name')
      await vi.waitFor(() => expect(name).toHaveValue(job.name))
      expect(view.getByRole('listitem', { name: 'State' })).toHaveTextContent('Resolved')
      expect(view.getByRole('listitem', { name: 'Call a webhook' })).toBeInTheDocument()
      expect(await view.findByRole('status', {}, { timeout: 3000 })).toHaveTextContent('3 tickets match now')

      await view.events.clear(name)
      await view.events.type(name, 'Close resolved tickets')
      await view.events.click(view.getByRole('button', { name: 'Sat' }))
      await view.events.click(view.getByRole('button', { name: 'Save job' }))

      await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/manage/scheduler'))
      const saved = calls.find((call) => call.method === 'PUT')?.body as Record<string, unknown>
      expect(saved.name).toBe('Close resolved tickets')
      expect(saved.condition).toEqual(job.condition)
      expect(saved.perform).toEqual(job.perform)
      expect((saved.timeplan as typeof everyTenMinutes).days.Sat).toBe(true)
      expect(saved.disable_notification).toBe(true)
    })

    it('builds a new job from conditions and actions', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/automation/options': () => ({ body: options }),
        'POST /api/v1/tickets/selector': () => ({ body: { object_count: 0 } }),
        'POST /api/v1/jobs': () => ({ status: 201, body: { id: 11 } }),
      })

      const view = await renderView(SchedulerJob, '/manage/scheduler/new')

      await view.events.type(await view.findByLabelText('Name'), 'Close old pending tickets')

      await view.events.selectOptions(view.getByLabelText('Add a condition'), 'ticket.state_id')
      const state = view.getByRole('listitem', { name: 'State' })
      await view.events.selectOptions(within(state).getByLabelText('Add a value'), '3')

      await view.events.selectOptions(view.getByLabelText('Add a condition'), 'ticket.updated_at')
      const updated = view.getByRole('listitem', { name: 'Updated at' })
      await view.events.clear(within(updated).getByLabelText('Amount'))
      await view.events.type(within(updated).getByLabelText('Amount'), '5')

      await view.events.selectOptions(view.getByLabelText('Add an action'), 'ticket.state_id')
      await view.events.selectOptions(within(view.getByRole('listitem', { name: 'Set state' })).getByLabelText('Value'), '4')

      await view.events.click(view.getByRole('button', { name: 'Save job' }))

      await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/v1/jobs')).toBe(true))
      const created = calls.find((call) => call.url === '/api/v1/jobs')?.body as Record<string, unknown>
      expect(created).toMatchObject({
        name: 'Close old pending tickets',
        object: 'Ticket',
        active: true,
        condition: {
          'ticket.state_id': { operator: 'is', value: ['3'] },
          'ticket.updated_at': { operator: 'before (relative)', value: '5', range: 'day' },
        },
        perform: { 'ticket.state_id': { value: '4' } },
      })
    })

    it('builds a job on users from their role, last login and tickets', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/automation/options': () => ({ body: userOptions }),
        'POST /api/v1/users/selector': () => ({ body: { object_count: 12 } }),
        'POST /api/v1/jobs': () => ({ status: 201, body: { id: 12 } }),
      })

      const view = await renderView(SchedulerJob, '/manage/scheduler/new')

      await view.events.type(await view.findByLabelText('Name'), 'Clean up old customers')
      await view.events.click(view.getByLabelText('Users'))

      await view.events.selectOptions(view.getByLabelText('Add a condition'), 'user.role_ids')
      await view.events.selectOptions(within(view.getByRole('listitem', { name: 'Role' })).getByLabelText('Add a value'), '3')

      await view.events.selectOptions(view.getByLabelText('Add a condition'), 'ticket_customer.open_existing')
      const openTickets = view.getByRole('listitem', { name: 'Tickets as customer › Has open tickets' })
      await view.events.selectOptions(within(openTickets).getByLabelText('Value'), 'false')

      await view.events.selectOptions(view.getByLabelText('Add a condition'), 'user.last_login')
      const lastLogin = view.getByRole('listitem', { name: 'Last login' })
      await view.events.selectOptions(within(lastLogin).getByLabelText('Operator'), 'before (absolute)')
      await view.events.type(within(lastLogin).getByLabelText('Date'), '2025-09-01T00:00')

      expect(await view.findByRole('status', {}, { timeout: 3000 })).toHaveTextContent('12 users match now')

      await view.events.selectOptions(view.getByLabelText('Add an action'), 'user.action')
      expect(view.getByRole('listitem', { name: 'Add a data privacy deletion task' })).toHaveTextContent('cannot be undone')
      expect(view.queryByRole('option', { name: 'Send an email' })).not.toBeInTheDocument()

      await view.events.click(view.getByRole('button', { name: 'Save job' }))

      await vi.waitFor(() => expect(calls.some((call) => call.method === 'POST' && call.url === '/api/v1/jobs')).toBe(true))
      expect(calls.find((call) => call.url === '/api/v1/jobs')?.body).toMatchObject({
        name: 'Clean up old customers',
        object: 'User',
        condition: {
          'user.role_ids': { operator: 'is', value: ['3'] },
          'ticket_customer.open_existing': { operator: 'is', value: false },
          'user.last_login': { operator: 'before (absolute)', value: '2025-09-01T00:00:00.000Z' },
        },
        perform: { 'user.action': { value: 'data_privacy_deletion_task' } },
      })
    })

    it('opens a job on organizations and keeps what it works on', async () => {
      const organizationJob = {
        ...job,
        id: 13,
        name: 'Unshare empty organizations',
        object: 'Organization',
        condition: { 'organization.members_existing': { operator: 'is', value: false } },
        perform: { 'organization.shared': { value: 'false' } },
      }
      const calls = mockServer({
        'GET /api/v1/studenthub/automation/options': () => ({ body: userOptions }),
        'GET /api/v1/jobs/13': () => ({ body: organizationJob }),
        'POST /api/v1/organizations/selector': () => ({ body: { object_count: 2 } }),
        'PUT /api/v1/jobs/13': () => ({ body: organizationJob }),
      })

      const view = await renderView(SchedulerJob, '/manage/scheduler/13')

      await vi.waitFor(() => expect(view.getByLabelText('Organizations')).toBeChecked())
      expect(view.getByLabelText('Tickets')).toBeDisabled()
      expect(view.getByRole('listitem', { name: 'Has members' })).toBeInTheDocument()
      expect(view.getByRole('listitem', { name: 'Set Shared organization' })).toBeInTheDocument()
      expect(await view.findByRole('status', {}, { timeout: 3000 })).toHaveTextContent('2 organizations match now')

      await view.events.click(view.getByRole('button', { name: 'Save job' }))

      await vi.waitFor(() => expect(calls.some((call) => call.method === 'PUT')).toBe(true))
      const saved = calls.find((call) => call.method === 'PUT')?.body as Record<string, unknown>
      expect(saved.object).toBe('Organization')
      expect(saved.condition).toEqual(organizationJob.condition)
      expect(saved.perform).toEqual(organizationJob.perform)
    })

    it('says what is missing instead of saving', async () => {
      const calls = mockServer({
        'GET /api/v1/studenthub/automation/options': () => ({ body: options }),
      })

      const view = await renderView(SchedulerJob, '/manage/scheduler/new')
      await view.findByLabelText('Name')
      await view.events.click(view.getByRole('button', { name: 'Save job' }))

      const alert = await view.findByRole('alert')
      expect(alert).toHaveTextContent('Give the job a name.')
      expect(alert).toHaveTextContent('Add at least one condition, so the job does not change every ticket.')
      expect(alert).toHaveTextContent('Add at least one action.')
      expect(calls.some((call) => call.method === 'POST')).toBe(false)
    })
  })
})
