// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'

import Macros from '../views/Macros.vue'
import ReportProfiles from '../views/ReportProfiles.vue'
import Slas from '../views/Slas.vue'
import TimeAccounting from '../views/TimeAccounting.vue'
import Triggers from '../views/Triggers.vue'

// Student Hub: Triggers, Macros, SLAs, Report Profiles and the Time Accounting selector use the
// shared condition and action editor (Automation/). Opening a record and saving it sends it back as
// it was, including trigger fields (Action, message), expert-mode groups and select fields.

const mockServer = (routes: Record<string, () => unknown>) => {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({
        method,
        url,
        body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
      })
      const handler = routes[`${method} ${url}`]
      return new Response(JSON.stringify(handler ? handler() : []), { status: handler ? 200 : 404 })
    }),
  )
  return calls
}

const automationOptions = {
  states: [
    { id: 2, name: 'open', active: true },
    { id: 4, name: 'closed', active: true },
  ],
  priorities: [{ id: 2, name: '2 normal', active: true }],
  groups: [{ id: 3, name: 'Service Desk', active: true }],
  agents: [{ id: 7, name: 'Test Agent', active: true }],
  organizations: [],
  webhooks: [{ id: 16, name: 'Teams alert', active: true }],
  article_senders: [
    { id: 1, name: 'Agent', active: true },
    { id: 2, name: 'Customer', active: true },
  ],
  article_types: [{ id: 11, name: 'web', active: true }],
  ticket_attributes: [
    {
      name: 'subcategory',
      display: 'Sub-category',
      data_type: 'select',
      active: true,
      options: [{ value: 'Onboarding (New Starter)', label: 'Onboarding (New Starter)' }],
    },
    {
      name: 'campus',
      display: 'Campus',
      data_type: 'tree_select',
      active: true,
      options: [{ value: 'LSST', label: 'LSST' }],
    },
  ],
}

const shared = {
  'GET /api/v1/studenthub/automation/options': () => automationOptions,
  'GET /api/v1/groups': () => [{ id: 3, name: 'Service Desk' }],
  'GET /api/v1/ticket_states': () => [{ id: 2, name: 'open' }],
  'GET /api/v1/ticket_priorities': () => [{ id: 2, name: '2 normal' }],
  'GET /api/v1/users?per_page=500': () => [],
  'GET /api/v1/calendars': () => [{ id: 1, name: 'Office hours', default: true }],
  'GET /api/v1/roles': () => [],
}

const render = (component: typeof Triggers) =>
  renderComponent(component, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

const sent = async (calls: ReturnType<typeof mockServer>, method: string, url: string) => {
  await waitFor(() =>
    expect(calls.find((call) => call.method === method && call.url === url)).toBeTruthy(),
  )
  return calls.find((call) => call.method === method && call.url === url)!.body!
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Triggers', () => {
  it('saves a trigger with Action, Sub-category, email, webhook and tags as it was', async () => {
    const trigger = {
      id: 18,
      name: 'Checklist : Onboarding',
      activator: 'action',
      execution_condition_mode: 'always',
      active: true,
      condition: {
        'ticket.action': { operator: 'is', value: 'create' },
        'ticket.subcategory': { operator: 'is', value: ['Onboarding (New Starter)'] },
        'article.sender_id': { operator: 'is', value: ['2'] },
      },
      perform: {
        'notification.email': {
          recipient: ['ticket_customer'],
          subject: 'Welcome',
          body: 'Hello',
          include_attachments: 'false',
        },
        'notification.webhook': { webhook_id: '16' },
        'ticket.tags': { operator: 'add', value: 'checklist-checd' },
      },
    }
    const calls = mockServer({
      ...shared,
      'GET /api/v1/triggers': () => [trigger],
      'PUT /api/v1/triggers/18': () => trigger,
    })

    const view = render(Triggers)
    await view.events.click(await view.findByText('Checklist : Onboarding'))

    expect(await view.findByRole('listitem', { name: 'Action' })).toBeInTheDocument()
    expect(view.getByRole('listitem', { name: 'Sub-category' })).toBeInTheDocument()
    expect(view.getByRole('listitem', { name: 'Message sender' })).toBeInTheDocument()
    expect(view.getByRole('listitem', { name: 'Send an email' })).toBeInTheDocument()
    expect(view.queryByText('Set elsewhere, kept as it is:')).not.toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Save' }))
    const body = await sent(calls, 'PUT', '/api/v1/triggers/18')

    expect(body.condition).toEqual(trigger.condition)
    expect(body.perform).toEqual(trigger.perform)
  })

  it('edits expert-mode conditions as groups and saves them as they were', async () => {
    const condition = {
      operator: 'AND',
      conditions: [
        { name: 'ticket.action', operator: 'is', value: 'update' },
        { name: 'ticket.state_id', operator: 'has changed', value: [] },
        { name: 'ticket.state_id', operator: 'is', value: ['4'] },
        { name: 'ticket.tags', operator: 'contains one not', value: 'closed-notified, spam' },
      ],
    }
    const trigger = {
      id: 40,
      name: 'Ticket Closed: Email Notification sent to the Customer',
      activator: 'action',
      active: true,
      condition,
      perform: {
        'notification.email': { recipient: ['ticket_customer'], subject: 'Closed', body: 'Bye' },
      },
    }
    const calls = mockServer({
      ...shared,
      'GET /api/v1/triggers': () => [trigger],
      'PUT /api/v1/triggers/40': () => trigger,
    })

    const view = render(Triggers)
    await view.events.click(await view.findByText(trigger.name))

    expect(await view.findByRole('group', { name: 'Condition group' })).toBeInTheDocument()
    expect(view.getAllByRole('listitem', { name: 'State' })).toHaveLength(2)

    await view.events.click(view.getByRole('button', { name: 'Save' }))
    const body = await sent(calls, 'PUT', '/api/v1/triggers/40')

    expect(body.condition).toEqual(condition)
  })

  it('switches expert mode on for a new trigger when Zammad allows it', async () => {
    mockApplicationConfig({ ticket_allow_expert_conditions: true })
    mockServer({ ...shared, 'GET /api/v1/triggers': () => [] })

    const view = render(Triggers)
    await view.events.click(await view.findByRole('button', { name: /New Trigger/ }))
    await view.events.click(await view.findByLabelText(/Expert mode/))

    expect(view.getByRole('group', { name: 'Condition group' })).toBeInTheDocument()
  })

  it('says what is missing instead of saving', async () => {
    const trigger = {
      id: 9,
      name: 'Half done',
      active: true,
      condition: { 'ticket.state_id': { operator: 'is', value: [] } },
      perform: {},
    }
    const calls = mockServer({ ...shared, 'GET /api/v1/triggers': () => [trigger] })

    const view = render(Triggers)
    await view.events.click(await view.findByText('Half done'))
    await view.events.click(await view.findByRole('button', { name: 'Save' }))

    expect(await view.findByText('State: choose at least one.')).toBeInTheDocument()
    expect(view.getByText('Add at least one action.')).toBeInTheDocument()
    expect(calls.some((call) => call.method === 'PUT')).toBe(false)
  })
})

it('saves a macro with its note, title, select fields and owner as it was', async () => {
  const macro = {
    id: 4,
    name: 'New starter',
    active: true,
    ux_flow_next_up: 'none',
    group_ids: [],
    perform: {
      'ticket.state_id': { value: '2' },
      'ticket.title': { value: 'New starter request' },
      'ticket.campus': { value: 'LSST' },
      'ticket.owner_id': { pre_condition: 'specific', value: '7', value_completion: '' },
      'article.note': { subject: 'Checklist', body: 'Started', internal: 'true' },
      'ticket.tags': { operator: 'add', value: 'onboarding' },
    },
  }
  const calls = mockServer({
    ...shared,
    'GET /api/v1/macros': () => [macro],
    'PUT /api/v1/macros/4': () => macro,
  })

  const view = render(Macros)
  await view.events.click(await view.findByText('New starter'))

  expect(await view.findByRole('listitem', { name: 'Set title' })).toBeInTheDocument()

  await view.events.click(view.getByRole('button', { name: 'Save' }))
  const body = await sent(calls, 'PUT', '/api/v1/macros/4')

  expect(body.perform).toEqual(macro.perform)
})

it('saves an SLA with a Sub-category condition as it was', async () => {
  const sla = {
    id: 3,
    name: 'Onboarding',
    calendar_id: 1,
    first_response_time: 60,
    condition: {
      'ticket.subcategory': { operator: 'is', value: ['Onboarding (New Starter)'] },
      'ticket.priority_id': { operator: 'is', value: ['2'] },
    },
  }
  const calls = mockServer({
    ...shared,
    'GET /api/v1/slas': () => [sla],
    'PUT /api/v1/slas/3': () => sla,
  })

  const view = render(Slas)
  await view.events.click(await view.findByText('Onboarding'))
  await view.events.click(await view.findByRole('button', { name: 'Save' }))
  const body = await sent(calls, 'PUT', '/api/v1/slas/3')

  expect(body.condition).toEqual(sla.condition)
})

it('saves a report profile with a Campus filter as it was', async () => {
  const profile = {
    id: 5,
    name: 'LSST reports',
    active: true,
    role_ids: [],
    condition: { 'ticket.campus': { operator: 'is', value: ['LSST'] } },
  }
  const calls = mockServer({
    ...shared,
    'GET /api/v1/report_profiles?expand=true': () => [profile],
    'POST /api/v1/tickets/selector': () => ({ object_count: 0, object_ids: [], assets: {} }),
    'PUT /api/v1/report_profiles/5': () => profile,
  })

  const view = render(ReportProfiles)
  await view.events.click(await view.findByText('LSST reports'))

  const preview = await sent(calls, 'POST', '/api/v1/tickets/selector')
  expect(preview.condition).toEqual(profile.condition)

  await view.events.click(view.getByRole('button', { name: 'Save Changes' }))
  const body = await sent(calls, 'PUT', '/api/v1/report_profiles/5')

  expect(body.condition).toEqual(profile.condition)
})

it('saves the Time Accounting selector as it was', async () => {
  const condition = {
    'ticket.subcategory': { operator: 'is', value: ['Onboarding (New Starter)'] },
  }
  const calls = mockServer({
    ...shared,
    'GET /api/v1/settings': () => [
      { id: 1, name: 'time_accounting_selector', state_current: { value: { condition } } },
      { id: 2, name: 'time_accounting_unit', state_current: { value: '' } },
      { id: 3, name: 'time_accounting_unit_custom', state_current: { value: '' } },
      { id: 4, name: 'time_accounting', state_current: { value: true } },
    ],
    'PUT /api/v1/settings/1': () => ({}),
    'PUT /api/v1/settings/2': () => ({}),
    'PUT /api/v1/settings/3': () => ({}),
  })

  const view = render(TimeAccounting)

  expect(await view.findByRole('listitem', { name: 'Sub-category' })).toBeInTheDocument()

  await view.events.click(view.getByRole('button', { name: 'Save Settings' }))
  const body = await sent(calls, 'PUT', '/api/v1/settings/1')

  expect(body.state_current).toEqual({ value: { condition } })
})
