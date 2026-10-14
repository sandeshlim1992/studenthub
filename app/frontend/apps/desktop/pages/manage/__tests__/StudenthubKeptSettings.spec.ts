// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import Templates from '../views/Templates.vue'

// Student Hub: the Templates editor keeps what it doesn't show (keptSettings.ts), so opening a
// template and saving it never deletes its message text or other fields.

const mockServer = (routes: Partial<Record<string, () => unknown>>) => {
  const calls: { method: string; url: string; body?: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
      const handler = routes[`${method} ${url}`]
      return new Response(JSON.stringify(handler ? handler() : []), { status: handler ? 200 : 404 })
    }),
  )
  return calls
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('saves a template with its message text and Category', async () => {
  const template = {
    id: 6,
    name: 'Laptop request',
    active: true,
    options: {
      'ticket.title': { value: 'Laptop request' },
      'ticket.category2': { value: 'Service Request' },
      'article.body': { value: '<p>Which laptop?</p>' },
    },
  }
  const calls = mockServer({
    'GET /api/v1/templates': () => [template],
    'GET /api/v1/groups': () => [],
    'GET /api/v1/ticket_states': () => [],
    'GET /api/v1/ticket_priorities': () => [],
    'GET /api/v1/users?per_page=500': () => [],
    'PUT /api/v1/templates/6': () => template,
  })

  const view = renderComponent(Templates, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })
  await view.events.click(await view.findByText('Laptop request'))

  expect(view.getByText('article.body')).toBeInTheDocument()

  await view.events.click(view.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(calls.find((call) => call.method === 'PUT')).toBeTruthy())

  expect(calls.find((call) => call.method === 'PUT')!.body!.options).toEqual(template.options)
})
