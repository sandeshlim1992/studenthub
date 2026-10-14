// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import ChannelForm from '../views/ChannelForm.vue'
import SystemDataPrivacy from '../views/SystemDataPrivacy.vue'

// Student Hub: both pages lost a declaration on 3 Oct, so the first keystroke in Data Privacy's
// user search and the Web Form page's embed code threw "… is not defined".

const mockServer = (routes: Record<string, unknown>) => {
  const fetchMock = vi.fn(async (url: string) => {
    const path = url.split('?')[0]
    return new Response(JSON.stringify(routes[path] ?? []), { status: path in routes ? 200 : 404 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const render = (component: unknown) =>
  renderComponent(component, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

it('Data Privacy finds the user typed into the search', async () => {
  const fetchMock = mockServer({
    '/api/v1/data_privacy_tasks/by_state': { record_ids: {}, assets: {} },
    '/api/v1/users/search': [
      { id: 5, firstname: 'Nicole', lastname: 'Braun', email: 'nicole@example.com' },
    ],
  })

  const view = render(SystemDataPrivacy)
  await view.events.click(await view.findByRole('button', { name: 'New Deletion Task' }))
  await view.events.type(view.getByLabelText(/Find User/), 'nic')

  expect(
    await view.findByRole('button', { name: 'Select user nicole@example.com' }),
  ).toBeInTheDocument()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/users/search?query=nic&limit=10',
    expect.anything(),
  )
})

it('the Web Form page shows its embed code', async () => {
  mockServer({ '/api/v1/settings': [], '/api/v1/groups': [{ id: 1, name: 'Service Desk' }] })

  const view = render(ChannelForm)

  expect(await view.findByText('Website Embed Code')).toBeInTheDocument()
  expect(view.getByText(/assets\/form\/form\.js"><\/script>/)).toBeInTheDocument()
})
