// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import SystemCoreWorkflows from '../views/SystemCoreWorkflows.vue'
import SystemMonitoring from '../views/SystemMonitoring.vue'
import Templates from '../views/Templates.vue'

// Student Hub: admin pages send Zammad's current security token with their saves. The token in
// the page from when it loaded belongs to the session of that moment: after signing out and in
// again without a reload the server refuses it (401).

vi.hoisted(() => {
  const meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = 'token-from-page-load'
  document.head.append(meta)
})

const mockServer = (routes: Record<string, () => unknown>) => {
  const calls: { method: string; url: string; token: string | null }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ method, url, token: new Headers(init.headers).get('X-CSRF-Token') })
      const route = `${method} ${url}`
      const known = route in routes
      return new Response(JSON.stringify(known ? routes[route]() : []), {
        status: known ? 200 : 404,
      })
    }),
  )
  return calls
}

const savesOf = (calls: { method: string }[]) => calls.filter((call) => call.method !== 'GET')

const render = (component: unknown) =>
  renderComponent(component, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

beforeEach(() => {
  setCSRFToken('current-token')
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('Core Workflows switches a workflow off with the current token', async () => {
  const calls = mockServer({
    'GET /api/v1/core_workflows': () => [
      {
        id: 7,
        name: 'Hide fields',
        object: 'Ticket',
        active: true,
        stop_after_match: false,
        changeable: true,
      },
    ],
    'PUT /api/v1/core_workflows/7': () => ({}),
  })

  const view = render(SystemCoreWorkflows)
  await view.events.click(await view.findByRole('switch', { name: /Toggle active state/ }))

  await waitFor(() => expect(savesOf(calls)).toHaveLength(1))
  expect(savesOf(calls)[0]).toMatchObject({ method: 'PUT', token: 'current-token' })
})

it('Monitoring resets its token with the current token', async () => {
  const calls = mockServer({
    'GET /api/v1/monitoring/health_check': () => ({ healthy: true, status: 'ok', token: 'abc' }),
    'POST /api/v1/monitoring/token': () => ({}),
  })

  const view = render(SystemMonitoring)
  await view.events.click(await view.findByRole('button', { name: 'Reset Monitoring Token' }))
  await view.events.click(await view.findByRole('button', { name: 'Reset Token Now' }))

  await waitFor(() => expect(savesOf(calls)).toHaveLength(1))
  expect(savesOf(calls)[0]).toMatchObject({ method: 'POST', token: 'current-token' })
})

it('a page that read the token from the page now sends the current one (Templates)', async () => {
  const template = { id: 6, name: 'Laptop request', active: true, options: {} }
  const calls = mockServer({
    'GET /api/v1/templates': () => [template],
    'PUT /api/v1/templates/6': () => template,
  })

  const view = render(Templates)
  await view.events.click(await view.findByText('Laptop request'))
  await view.events.click(view.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(savesOf(calls)).toHaveLength(1))
  expect(savesOf(calls)[0]).toMatchObject({ method: 'PUT', token: 'current-token' })
})
