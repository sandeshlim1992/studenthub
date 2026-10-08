// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import PublicLinks from '../views/PublicLinks.vue'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForVariantConfirmation: mockWaitForVariantConfirmation }),
}))

const links = [
  { id: 2, title: 'Privacy notice', link: 'https://www.lsst.ac/privacy', description: null, screen: ['login'], new_tab: true, prio: 2 },
  { id: 1, title: 'IT help', link: 'https://it.lsst.ac', description: 'Guides and contacts', screen: ['login', 'password_reset'], new_tab: true, prio: 1 },
]

const mockServer = (routes: Record<string, () => { status?: number; body: unknown }>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
      const handler = routes[`${method} ${url}`]
      const reply = handler ? handler() : { status: 404, body: { error: `No mock for ${method} ${url}` } }
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
    }),
  )
  return calls
}

const renderPage = () =>
  renderComponent(PublicLinks, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

describe('Public Links', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists the links in their order with the pages they are on', async () => {
    mockServer({ 'GET /api/v1/public_links': () => ({ body: links }) })

    const view = renderPage()

    const items = await view.findAllByRole('listitem')
    expect(items.map((item) => item.getAttribute('aria-label'))).toEqual(['IT help', 'Privacy notice'])
    expect(items[0]).toHaveTextContent('Sign-in page')
    expect(items[0]).toHaveTextContent('Password reset page')
  })

  it('adds a link', async () => {
    const calls = mockServer({
      'GET /api/v1/public_links': () => ({ body: links }),
      'POST /api/v1/public_links': () => ({ status: 201, body: { id: 3 } }),
    })

    const view = renderPage()
    await view.findAllByRole('listitem')
    await view.events.click(view.getByRole('button', { name: 'New link' }))

    const form = view.getByRole('form', { name: 'New link' })
    await view.events.click(within(form).getByRole('button', { name: 'Save link' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Enter a title.')

    await view.events.type(within(form).getByLabelText('Title'), 'Student portal')
    await view.events.type(within(form).getByLabelText('Address'), 'https://portal.lsst.ac')
    await view.events.click(within(form).getByLabelText('Password reset page'))
    await view.events.click(within(form).getByRole('button', { name: 'Save link' }))

    await vi.waitFor(() => expect(view.queryByRole('form')).not.toBeInTheDocument())
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({
      title: 'Student portal',
      link: 'https://portal.lsst.ac',
      description: null,
      screen: ['login', 'password_reset'],
      new_tab: true,
    })
  })

  it('moves a link down and deletes one', async () => {
    const calls = mockServer({
      'GET /api/v1/public_links': () => ({ body: links }),
      'POST /api/v1/public_links_prio': () => ({ body: { success: true } }),
      'DELETE /api/v1/public_links/2': () => ({ body: {} }),
    })

    const view = renderPage()
    await view.findAllByRole('listitem')

    await view.events.click(view.getByRole('button', { name: 'Move IT help down' }))
    await vi.waitFor(() =>
      expect(calls.find((call) => call.url === '/api/v1/public_links_prio')?.body).toEqual({ prios: [[2, 1], [1, 2]] }),
    )

    await view.events.click(view.getByRole('button', { name: 'Delete Privacy notice' }))
    expect(mockWaitForVariantConfirmation).toHaveBeenCalledWith('delete')
    await vi.waitFor(() => expect(calls.some((call) => call.method === 'DELETE')).toBe(true))
  })
})
