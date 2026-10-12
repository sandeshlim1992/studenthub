// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import Macros from '../views/Macros.vue'
import Triggers from '../views/Triggers.vue'

// Student Hub: the simple editors keep what they don't show (keptSettings.ts), so opening a record
// and saving it never deletes its emails, tags, notes or other conditions.

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

const lists = {
  'GET /api/v1/groups': () => [{ id: 3, name: 'Service Desk' }],
  'GET /api/v1/ticket_states': () => [{ id: 2, name: 'open' }],
  'GET /api/v1/ticket_priorities': () => [{ id: 2, name: '2 normal' }],
  'GET /api/v1/users?per_page=500': () => [],
}

const render = (component: typeof Triggers) =>
  renderComponent(component, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

const saved = async (calls: ReturnType<typeof mockServer>, url: string) => {
  await waitFor(() =>
    expect(calls.find((call) => call.method === 'PUT' && call.url === url)).toBeTruthy(),
  )
  return calls.find((call) => call.method === 'PUT' && call.url === url)!.body!
}

describe('simple admin editors keep what they do not show', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves a trigger with its email, tags and other conditions', async () => {
    const trigger = {
      id: 7,
      name: 'Agent replied on the web',
      activator: 'action',
      execution_condition_mode: 'selective',
      active: true,
      condition: {
        'ticket.state_id': { operator: 'is', value: ['2'] },
        'article.type_id': { operator: 'is', value: ['11'] },
      },
      perform: {
        'ticket.state_id': { value: '2' },
        'notification.email': {
          recipient: ['ticket_customer'],
          subject: 'New reply',
          body: 'Hello',
        },
        'ticket.tags': { operator: 'add', value: 'replied' },
      },
    }
    const calls = mockServer({
      ...lists,
      'GET /api/v1/triggers': () => [trigger],
      'PUT /api/v1/triggers/7': () => trigger,
    })

    const view = render(Triggers)
    await view.events.click(await view.findByText('Agent replied on the web'))

    expect(view.getByText('article.type_id')).toBeInTheDocument()
    expect(view.getByText('notification.email')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Save' }))
    const body = await saved(calls, '/api/v1/triggers/7')

    expect(body.condition).toEqual(trigger.condition)
    expect(body.perform).toEqual(trigger.perform)
  })

  it('saves expert-mode trigger conditions as they were', async () => {
    const condition = {
      operator: 'AND',
      conditions: [{ name: 'ticket.state_id', operator: 'is', value: ['2'] }],
    }
    const trigger = {
      id: 8,
      name: 'Expert trigger',
      activator: 'action',
      active: true,
      condition,
      perform: { 'ticket.state_id': { value: '2' } },
    }
    const calls = mockServer({
      ...lists,
      'GET /api/v1/triggers': () => [trigger],
      'PUT /api/v1/triggers/8': () => trigger,
    })

    const view = render(Triggers)
    await view.events.click(await view.findByText('Expert trigger'))

    expect(view.getByText(/use the classic admin's expert mode/)).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Save' }))
    const body = await saved(calls, '/api/v1/triggers/8')

    expect(body.condition).toEqual(condition)
  })

  it('saves a macro with its note and tags', async () => {
    const macro = {
      id: 4,
      name: 'Close with a note',
      active: true,
      ux_flow_next_up: 'none',
      group_ids: [],
      perform: {
        'ticket.state_id': { value: '2', operator: 'is' },
        'article.note': { body: 'Closed by macro', internal: 'true', subject: '' },
        'ticket.tags': { operator: 'add', value: 'done' },
      },
    }
    const calls = mockServer({
      ...lists,
      'GET /api/v1/macros': () => [macro],
      'PUT /api/v1/macros/4': () => macro,
    })

    const view = render(Macros)
    await view.events.click(await view.findByText('Close with a note'))
    await view.events.click(view.getByRole('button', { name: 'Save' }))
    const body = await saved(calls, '/api/v1/macros/4')

    expect(body.perform).toEqual(macro.perform)
  })
})
