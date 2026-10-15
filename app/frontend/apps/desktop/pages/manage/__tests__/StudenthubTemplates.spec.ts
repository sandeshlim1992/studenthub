// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor, within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import Templates from '../views/Templates.vue'

import type { AutomationOptions } from '../components/Automation/automation.ts'

// Student Hub: the Templates editor shows every field a template fills in (the message text,
// Category, …) with the shared action editor, and saves a template it opened as it was.

const options: AutomationOptions = {
  states: [{ id: 2, name: 'open', active: true }],
  priorities: [{ id: 4, name: 'P1 - High', active: true }],
  groups: [{ id: 26, name: 'Service Desk', active: true }],
  agents: [{ id: 7, name: 'Test Agent', active: true }],
  organizations: [],
  webhooks: [],
  ticket_attributes: [
    {
      name: 'category2',
      display: 'Category',
      data_type: 'tree_select',
      active: true,
      options: [{ value: 'Service Request', label: 'Service Request' }],
    },
    {
      name: 'itil_type',
      display: 'ITIL type',
      data_type: 'multi_tree_select',
      active: true,
      options: [{ value: 'Service Requests', label: 'Service Requests' }],
    },
  ],
}

// A template from the test server.
const template = {
  id: 6,
  name: 'Password Reset Request',
  active: true,
  options: {
    'article.body': {
      value: '<div><p>Dear IT Support,</p><p>Could you please reset my password?</p></div>',
    },
    'ticket.title': { value: 'Password Reset Request' },
    'ticket.category2': { value: 'Service Request' },
    'ticket.group_id': { value: '26' },
    'ticket.itil_type': { value: ['Service Requests'], value_completion: '' },
    'ticket.priority_id': { value: '4' },
    'ticket.unknown_field': { value: 'kept' },
  },
}

const mockServer = (routes: Partial<Record<string, () => unknown>>) => {
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

const renderTemplates = () =>
  renderComponent(Templates, {
    router: true,
    store: true,
    form: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

it('lists what each template fills in', async () => {
  mockServer({
    'GET /api/v1/templates': () => [template],
    'GET /api/v1/studenthub/automation/options': () => options,
  })

  const view = renderTemplates()

  const row = (await view.findByText('Password Reset Request', { selector: 'div' })).closest('tr')!
  await waitFor(() => expect(row).toHaveTextContent('Set Category: Service Request'))
  expect(row).toHaveTextContent('Set ITIL type: Service Requests')
  expect(row).toHaveTextContent('Move to team: Service Desk')
  expect(row).toHaveTextContent('Message text')
})

it('shows every field of a template and saves it as it was', async () => {
  const calls = mockServer({
    'GET /api/v1/templates': () => [template],
    'GET /api/v1/studenthub/automation/options': () => options,
    'PUT /api/v1/templates/6': () => template,
  })

  const view = renderTemplates()
  await view.findByText('Set Category: Service Request')
  await view.events.click(view.getByText('Password Reset Request', { selector: 'div' }))

  // Tests render the shared form's editor as a plain text area.
  const message = within(
    await view.findByRole('listitem', { name: 'Message text' }),
  ).getByLabelText('Message text')
  await waitFor(() => expect(message).toHaveValue(template.options['article.body'].value))
  expect(
    within(view.getByRole('listitem', { name: 'Set Category' })).getByLabelText('Value'),
  ).toHaveValue('Service Request')
  expect(view.getByRole('listitem', { name: 'Set ITIL type' })).toHaveTextContent(
    'Service Requests',
  )
  expect(view.getByRole('listitem', { name: 'ticket.unknown_field' })).toHaveTextContent(
    'kept as it is',
  )

  await view.events.click(view.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(calls.find((call) => call.method === 'PUT')).toBeTruthy())

  expect(calls.find((call) => call.method === 'PUT')!.body!.options).toEqual(template.options)
})

it('fills in a new template and says what is missing', async () => {
  const calls = mockServer({
    'GET /api/v1/templates': () => [],
    'GET /api/v1/studenthub/automation/options': () => options,
    'POST /api/v1/templates': () => ({ id: 7 }),
  })

  const view = renderTemplates()
  await view.findByText('No templates found')
  await waitFor(() =>
    expect(calls.some((call) => call.url === '/api/v1/studenthub/automation/options')).toBe(true),
  )
  await view.events.click(view.getByRole('button', { name: 'New Template' }))

  await view.events.type(view.getByPlaceholderText('Name of the template'), 'Laptop request')
  await view.events.type(
    within(await view.findByRole('listitem', { name: 'Set title' })).getByLabelText('Value'),
    'New laptop',
  )

  await view.events.selectOptions(view.getByLabelText('Add an action'), 'ticket.category2')
  await view.events.selectOptions(
    within(view.getByRole('listitem', { name: 'Set Category' })).getByLabelText('Value'),
    'Service Request',
  )

  await view.events.selectOptions(view.getByLabelText('Add an action'), 'ticket.formSenderType')
  await view.events.selectOptions(
    within(view.getByRole('listitem', { name: 'Comes in as' })).getByLabelText('Value'),
    'phone-in',
  )

  await view.events.selectOptions(view.getByLabelText('Add an action'), 'article.body')
  await view.events.click(view.getByRole('button', { name: 'Save' }))

  expect(await view.findByRole('alert')).toHaveTextContent('Message text: enter a text.')
  expect(calls.some((call) => call.method === 'POST')).toBe(false)

  await view.events.type(
    within(view.getByRole('listitem', { name: 'Message text' })).getByLabelText('Message text'),
    'Which laptop?',
  )
  await view.events.click(view.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(calls.some((call) => call.method === 'POST')).toBe(true))
  expect(calls.find((call) => call.method === 'POST')!.body).toEqual({
    name: 'Laptop request',
    active: true,
    options: {
      'ticket.title': { value: 'New laptop' },
      'ticket.category2': { value: 'Service Request' },
      'ticket.formSenderType': { value: 'phone-in' },
      'article.body': { value: 'Which laptop?' },
    },
  })
})
