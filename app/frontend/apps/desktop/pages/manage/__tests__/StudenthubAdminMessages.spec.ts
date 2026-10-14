// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import SystemCoreWorkflows from '../views/SystemCoreWorkflows.vue'

// Student Hub: admin page messages show the name they're about. `__()` only marks text for
// translation and drops the values, so they showed a raw "%s"; they go through i18n.t / $t.

const workflow = {
  id: 7,
  name: 'Hide fields',
  object: 'Ticket',
  active: true,
  stop_after_match: false,
  changeable: true,
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = init.method === 'PUT' ? { ...workflow, active: false } : [workflow]
      return new Response(JSON.stringify(url.endsWith('/core_workflows/7') || !init.method ? body : []))
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('names the workflow in its switch and in the message after switching it off', async () => {
  const view = renderComponent(SystemCoreWorkflows, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

  await view.events.click(
    await view.findByRole('switch', { name: 'Toggle active state for Hide fields' }),
  )

  expect(await view.findByText('Workflow "Hide fields" deactivated.')).toBeInTheDocument()
  expect(view.queryByText(/%s/)).not.toBeInTheDocument()
})
