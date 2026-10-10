// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import Departments from '../views/Departments.vue'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForVariantConfirmation: mockWaitForVariantConfirmation }),
}))

const campuses = [
  { value: 'LSST Wembley', label: 'LSST Wembley' },
  { value: 'FSB Sheffield', label: 'FSB Sheffield' },
]

const registry = {
  id: 1,
  name: 'Registry',
  locations: ['LSST Wembley', 'UKBC Old'],
  email: 'registry@studenthub.example',
  missing_locations: ['UKBC Old'],
  updated_at: '2026-10-11T10:00:00Z',
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
  renderComponent(Departments, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

describe('Departments', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the departments with their campuses and email address', async () => {
    mockServer({
      'GET /api/v1/studenthub/departments': () => ({ body: { departments: [registry], campuses } }),
    })

    const view = renderPage()

    const item = await view.findByRole('listitem', { name: 'Registry' })
    expect(item).toHaveTextContent('LSST Wembley, UKBC Old · registry@studenthub.example')
    expect(item).toHaveTextContent('No longer a campus: UKBC Old')
  })

  it('makes a new department', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/departments': () => ({ body: { departments: [], campuses } }),
      'POST /api/v1/studenthub/departments': (body) => ({
        status: 201,
        body: { ...body, id: 2, missing_locations: [] },
      }),
    })

    const view = renderPage()
    await view.events.click(await view.findByRole('button', { name: 'New department' }))

    await view.events.type(view.getByLabelText('Name'), 'Student Finance')
    await view.events.click(view.getByLabelText('FSB Sheffield'))
    await view.events.type(view.getByLabelText('Email address'), 'finance@studenthub.example')
    await view.events.click(view.getByRole('button', { name: 'Save' }))

    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      name: 'Student Finance',
      locations: ['FSB Sheffield'],
      email: 'finance@studenthub.example',
    })
    await vi.waitFor(() =>
      expect(useNotifications().notifications.value.at(-1)?.message).toBe(
        'The department has been saved.',
      ),
    )
  })

  it('changes and deletes a department, and shows a campus the field dropped', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/departments': () => ({ body: { departments: [registry], campuses } }),
      'PUT /api/v1/studenthub/departments/1': (body) => ({ body: { ...registry, ...body } }),
      'DELETE /api/v1/studenthub/departments/1': () => ({ body: {} }),
    })

    const view = renderPage()
    await view.events.click(await view.findByRole('button', { name: 'Edit Registry' }))

    const dropped = view.getByLabelText(/UKBC Old/)
    expect(dropped).toBeChecked()
    expect(view.getByText('No longer a campus')).toBeInTheDocument()

    await view.events.click(dropped)
    await view.events.click(view.getByRole('button', { name: 'Save' }))
    expect(calls.find((call) => call.method === 'PUT')?.body.locations).toEqual(['LSST Wembley'])

    await view.events.click(await view.findByRole('button', { name: 'Edit Registry' }))
    await view.events.click(view.getByRole('button', { name: 'Delete' }))

    expect(mockWaitForVariantConfirmation).toHaveBeenCalledWith('delete')
    expect(calls.some((call) => call.method === 'DELETE')).toBe(true)
  })
})
