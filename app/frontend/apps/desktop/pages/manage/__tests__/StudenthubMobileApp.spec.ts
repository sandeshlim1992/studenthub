// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import MobileApp from '../views/MobileApp.vue'

const moodle = { label: 'Moodle', url: 'https://moodle.example.ac.uk' }
const timetable = { label: 'Timetable', url: 'https://timetable.example.ac.uk' }

const mockServer = (
  links: unknown,
  saveReply: (body: any) => { status?: number; body: unknown } = () => ({ body: {} }),
) => {
  const saves: any[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if ((init.method ?? 'GET') === 'GET' && url === '/api/v1/settings') {
        return new Response(
          JSON.stringify([
            { id: 7, name: 'product_name', state_current: { value: 'Student Hub' } },
            { id: 42, name: 'studenthub_mobile_quick_links', state_current: { value: links } },
          ]),
        )
      }
      if (init.method === 'PUT' && url === '/api/v1/settings/42') {
        const body = JSON.parse(init.body as string)
        saves.push(body)
        const reply = saveReply(body)
        return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
      }
      return new Response(JSON.stringify({ error: `No mock for ${url}` }), { status: 404 })
    }),
  )

  return saves
}

const renderPage = () =>
  renderComponent(MobileApp, {
    router: true,
    store: true,
    // The popular answers section has its own spec (MobileAppPopularAnswers.spec.ts).
    global: {
      stubs: { LayoutContent: { template: '<div><slot /></div>' }, MobileAppPopularAnswers: true },
    },
  })

const rows = (view: ReturnType<typeof renderPage>) =>
  view
    .getAllByRole('listitem')
    .map((row) => [
      within(row).getByLabelText('Label') as HTMLInputElement,
      within(row).getByLabelText('Web address') as HTMLInputElement,
    ])
    .map(([label, url]) => `${label.value} ${url.value}`)

// Student Hub: Administration → Manage → Mobile app.
describe('Mobile app admin page', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the saved quick links in order', async () => {
    mockServer([moodle, timetable])

    const view = renderPage()

    expect(await view.findByRole('heading', { name: 'Quick links' })).toBeInTheDocument()
    expect(rows(view)).toEqual([
      'Moodle https://moodle.example.ac.uk',
      'Timetable https://timetable.example.ac.uk',
    ])
    expect(view.getByRole('button', { name: 'Save quick links' })).toBeDisabled()
  })

  it('adds, orders and removes links and saves them trimmed', async () => {
    const saves = mockServer([moodle, timetable])

    const view = renderPage()
    await view.findByRole('heading', { name: 'Quick links' })

    await view.events.click(view.getByRole('button', { name: 'Add link' }))
    await view.events.type(
      view.getByLabelText('Label', { selector: '#quick-link-label-2' }),
      ' Library ',
    )
    await view.events.type(
      view.getByLabelText('Web address', { selector: '#quick-link-url-2' }),
      'library.example.ac.uk',
    )
    await view.events.click(view.getByRole('button', { name: 'Move link 3 up' }))
    await view.events.click(view.getByRole('button', { name: 'Remove link 1' }))
    await view.events.click(view.getByRole('button', { name: 'Save quick links' }))

    expect(saves).toEqual([
      {
        state_current: {
          value: [{ label: 'Library', url: 'https://library.example.ac.uk' }, timetable],
        },
      },
    ])
    await vi.waitFor(() =>
      expect(useNotifications().notifications.value.at(-1)?.message).toBe('Quick links saved.'),
    )
    expect(view.getByRole('button', { name: 'Save quick links' })).toBeDisabled()
  })

  it('explains what is missing and saves nothing', async () => {
    const saves = mockServer([])

    const view = renderPage()
    expect(await view.findByText('No quick links yet.')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Add link' }))
    await view.events.clear(view.getByLabelText('Web address'))
    await view.events.type(view.getByLabelText('Web address'), 'javascript:alert(1)')
    await view.events.click(view.getByRole('button', { name: 'Save quick links' }))

    expect(view.getByRole('alert')).toHaveTextContent('Enter a label.')

    await view.events.type(view.getByLabelText('Label'), 'Moodle')

    expect(view.getByRole('alert')).toHaveTextContent(
      'Enter a full web address, starting with https://.',
    )
    expect(saves).toEqual([])
  })

  it("shows the server's message when saving fails", async () => {
    mockServer([moodle], () => ({
      status: 422,
      body: { error_human: 'There can be at most 8 quick links.' },
    }))

    const view = renderPage()
    await view.findByRole('heading', { name: 'Quick links' })

    await view.events.click(view.getByRole('button', { name: 'Remove link 1' }))
    await view.events.click(view.getByRole('button', { name: 'Save quick links' }))

    await vi.waitFor(() =>
      expect(useNotifications().notifications.value.at(-1)?.message).toBe(
        'There can be at most 8 quick links.',
      ),
    )
  })

  it('allows at most 8 links', async () => {
    mockServer(Array.from({ length: 8 }, () => moodle))

    const view = renderPage()
    await view.findByRole('heading', { name: 'Quick links' })

    expect(view.getByRole('button', { name: 'Add link' })).toBeDisabled()
  })
})
