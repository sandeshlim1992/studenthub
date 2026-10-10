// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import RequestForms from '../views/RequestForms.vue'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({
    waitForVariantConfirmation: mockWaitForVariantConfirmation,
    waitForConfirmation: mockWaitForVariantConfirmation,
  }),
}))

const options = {
  categories: [
    { value: 'Service Request', label: 'Service Request' },
    { value: 'Software', label: 'Software' },
  ],
  sub_categories: {
    'Service Request': [
      { value: 'Onboarding (New Starter)', label: 'Onboarding (New Starter)' },
      { value: 'Password Reset', label: 'Password Reset' },
    ],
    Software: [{ value: 'Outlook', label: 'Outlook' }],
  },
  fields: [
    { name: 'start_date', display: 'Start date', data_type: 'date', shown_for: [] },
    { name: 'impact', display: 'Impact', data_type: 'tree_select', shown_for: ['staff'] },
  ],
  organizations: [
    { id: 6, name: 'LSST' },
    { id: 9, name: 'HR' },
  ],
  roles: [{ id: 3, name: 'Customer' }],
}

const definition = {
  category: 'Service Request',
  sub_category: 'Onboarding (New Starter)',
  title: 'Staff onboarding',
  help_text: 'Tell us about the new starter.',
  items: [{ type: 'field', name: 'start_date', required: true }],
  fields: [{ name: 'start_date', required: true }],
  organization_ids: [9],
  role_ids: [],
}

const publishedForm = {
  id: 1,
  draft: definition,
  published: definition,
  status: 'published',
  problems: [],
  published_problems: [],
  published_at: '2026-10-09T10:00:00Z',
  published_by: 'Test Admin',
  updated_at: '2026-10-09T10:00:00Z',
}

const mockServer = (routes: Record<string, (body?: any) => { status?: number; body: unknown }>) => {
  const calls: { method: string; url: string; body?: any }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ method, url, body })
      const handler = routes[`${method} ${url}`]
      const reply = handler
        ? handler(body)
        : { status: 404, body: { error: `No mock for ${method} ${url}` } }
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
    }),
  )
  return calls
}

const renderPage = () =>
  renderComponent(RequestForms, {
    router: true,
    store: true,
    global: {
      stubs: {
        LayoutContent: { template: '<div><slot /></div>' },
        // Zammad's own form fields need the ticket fields from the server; the browser check covers them.
        StudenthubRequestFormSection: {
          props: ['form'],
          template:
            '<div data-test-id="section">{{ form.title || form.sub_category }}: {{ form.fields.map((f) => f.name).join(", ") }}</div>',
        },
      },
    },
  })

describe('Request forms', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the forms with their status, sub-category, fields and who they are for', async () => {
    mockServer({
      'GET /api/v1/studenthub/request_forms': () => ({
        body: {
          forms: [
            { ...publishedForm, published_problems: ['This sub-category no longer exists.'] },
          ],
          options,
        },
      }),
    })

    const view = renderPage()

    const item = await view.findByRole('listitem', { name: 'Staff onboarding' })
    expect(item).toHaveTextContent('Published')
    expect(item).toHaveTextContent('Service Request › Onboarding (New Starter)')
    expect(item).toHaveTextContent('1 field(s)')
    expect(item).toHaveTextContent('For: HR')
    expect(item).toHaveTextContent('Not applied: This sub-category no longer exists.')
  })

  it('makes a new form, previews it and saves it as a draft', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/request_forms': () => ({ body: { forms: [publishedForm], options } }),
      'POST /api/v1/studenthub/request_forms': (body) => ({
        status: 201,
        body: {
          ...publishedForm,
          id: 2,
          draft: body.draft,
          published: null,
          status: 'draft',
          problems: [],
        },
      }),
    })

    const view = renderPage()
    await view.findByRole('listitem', { name: 'Staff onboarding' })
    await view.events.click(view.getByRole('button', { name: 'New request form' }))

    await view.events.selectOptions(view.getByLabelText('Category'), 'Service Request')
    const subCategory = view.getByLabelText('Sub-category')
    expect(
      within(subCategory).getByRole('option', { name: 'Onboarding (New Starter) (has a form)' }),
    ).toBeDisabled()
    await view.events.selectOptions(subCategory, 'Password Reset')

    await view.events.selectOptions(view.getByLabelText('Add an existing Zammad field'), 'impact')
    await view.events.click(view.getByRole('button', { name: 'Add' }))
    await view.events.click(view.getByLabelText('Required'))

    const field = view.getByRole('listitem', { name: 'Impact' })
    expect(field).toHaveTextContent("also on staff's New ticket form")
    expect(view.getByText('Password Reset: impact')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Save draft' }))

    expect(calls.find((call) => call.method === 'POST')?.body.draft).toEqual({
      category: 'Service Request',
      sub_category: 'Password Reset',
      title: '',
      help_text: '',
      items: [{ type: 'field', name: 'impact', required: true }],
      fields: [{ name: 'impact', required: true }],
      organization_ids: [],
      role_ids: [],
    })
    expect(await view.findByRole('heading', { level: 1 })).toHaveTextContent('Password Reset Draft')
  })

  it('puts headings and notes between the fields', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/request_forms': () => ({ body: { forms: [publishedForm], options } }),
      'PUT /api/v1/studenthub/request_forms/1': (body) => ({
        body: { ...publishedForm, draft: body.draft, status: 'changed' },
      }),
    })

    const view = renderPage()
    await view.events.click(await view.findByRole('button', { name: 'Edit Staff onboarding' }))

    await view.events.click(view.getByRole('button', { name: 'Add heading' }))
    await view.events.type(view.getByPlaceholderText('e.g. Employee'), 'Employee')
    await view.events.click(view.getByRole('button', { name: 'Move Employee up' }))
    await view.events.click(view.getByRole('button', { name: 'Add note' }))
    await view.events.type(
      view.getByPlaceholderText('Shown on the form only, e.g. what an answer is used for.'),
      'We set up the account before this date.',
    )

    await view.events.click(view.getByRole('button', { name: 'Save draft' }))

    expect(calls.find((call) => call.method === 'PUT')?.body.draft).toMatchObject({
      items: [
        { type: 'heading', text: 'Employee' },
        { type: 'field', name: 'start_date', required: true },
        { type: 'note', text: 'We set up the account before this date.' },
      ],
      fields: [{ name: 'start_date', required: true }],
    })
  })

  it('keeps changes to a published form apart until they are published', async () => {
    const changed = { ...definition, title: 'New starters' }
    const calls = mockServer({
      'GET /api/v1/studenthub/request_forms': () => ({ body: { forms: [publishedForm], options } }),
      'PUT /api/v1/studenthub/request_forms/1': () => ({
        body: { ...publishedForm, draft: changed, status: 'changed' },
      }),
      'POST /api/v1/studenthub/request_forms/1/publish': () => ({
        body: { ...publishedForm, draft: changed, published: changed },
      }),
    })

    const view = renderPage()
    await view.events.click(await view.findByRole('button', { name: 'Edit Staff onboarding' }))
    expect(view.getByRole('heading', { level: 1 })).toHaveTextContent('Staff onboarding Published')
    expect(view.getByLabelText('HR')).toBeChecked()

    await view.events.clear(view.getByLabelText('Heading'))
    await view.events.type(view.getByLabelText('Heading'), 'New starters')
    expect(view.getByRole('heading', { level: 1 })).toHaveTextContent(
      'New starters Unpublished changes',
    )

    await view.events.click(view.getByRole('button', { name: 'Publish changes' }))

    expect(
      calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.url}`),
    ).toEqual([
      'PUT /api/v1/studenthub/request_forms/1',
      'POST /api/v1/studenthub/request_forms/1/publish',
    ])
    await vi.waitFor(() =>
      expect(view.getByRole('heading', { level: 1 })).toHaveTextContent('New starters Published'),
    )
    expect(useNotifications().notifications.value.at(-1)?.message).toBe(
      'The request form has been published.',
    )
  })

  it('adds a question of the form itself', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/request_forms': () => ({ body: { forms: [publishedForm], options } }),
      'PUT /api/v1/studenthub/request_forms/1': (body) => ({
        body: { ...publishedForm, draft: body.draft, status: 'changed' },
      }),
    })

    const view = renderPage()
    await view.events.click(await view.findByRole('button', { name: 'Edit Staff onboarding' }))

    await view.events.click(view.getByRole('button', { name: 'New question' }))
    const panel = view.getByRole('region', { name: 'New question' })
    expect(within(panel).getByRole('button', { name: 'Add question' })).toBeDisabled()

    await view.events.type(within(panel).getByLabelText('Question'), 'Laptop model')
    await view.events.selectOptions(within(panel).getByLabelText('Type'), 'select')
    await view.events.type(within(panel).getByLabelText('Options, one per line'), 'Standard{Enter}High-spec{Enter}Standard')
    await view.events.click(within(panel).getByLabelText('Required'))
    await view.events.click(within(panel).getByRole('button', { name: 'Add question' }))

    const row = view.getByRole('listitem', { name: 'Laptop model' })
    expect(row).toHaveTextContent('Question of this form · Dropdown')

    await view.events.click(view.getByRole('button', { name: 'Save draft' }))

    expect(calls.find((call) => call.method === 'PUT')?.body.draft.items).toEqual([
      { type: 'field', name: 'start_date', required: true },
      {
        type: 'question',
        key: 'laptop_model',
        label: 'Laptop model',
        kind: 'select',
        help: '',
        required: true,
        options: ['Standard', 'High-spec'],
      },
    ])
  })
})
