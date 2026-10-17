// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import MobileAppPopularAnswers from '../MobileAppPopularAnswers.vue'

const choices = [
  { id: 1, title: 'Connect to the Wi-Fi', category: 'How-to guides' },
  { id: 2, title: 'Reset your password', category: 'Accounts' },
  { id: 3, title: 'Print from your laptop', category: 'How-to guides' },
  { id: 4, title: 'Book a study room', category: 'Library' },
  { id: 5, title: 'Set up college email', category: 'Email' },
  { id: 6, title: 'Find your timetable', category: 'Timetable' },
]

const mockServer = (
  chosen: number[],
  saveReply: () => { status?: number; body: unknown } = () => ({ body: {} }),
) => {
  const saves: unknown[] = []

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      if (method === 'GET' && url === '/api/v1/settings') {
        return new Response(
          JSON.stringify([{ id: 43, name: 'studenthub_mobile_popular_answers', state_current: { value: chosen } }]),
        )
      }
      if (method === 'GET' && url === '/api/v1/studenthub/mobile_app/answer_choices') {
        return new Response(JSON.stringify(choices))
      }
      if (method === 'PUT' && url === '/api/v1/settings/43') {
        saves.push(JSON.parse(init.body as string))
        const reply = saveReply()
        return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
      }
      return new Response(JSON.stringify({ error: `No mock for ${url}` }), { status: 404 })
    }),
  )

  return saves
}

const renderSection = () => renderComponent(MobileAppPopularAnswers, { router: true, store: true })

const chosenTitles = (view: ReturnType<typeof renderSection>) =>
  within(view.getByRole('list', { name: '' }))
    .getAllByRole('listitem')
    .map((item) => item.getAttribute('aria-label'))

const lastNotification = () => useNotifications().notifications.value.at(-1)?.message

// Student Hub: Administration → Manage → Mobile app → Popular answers.
describe('Mobile app popular answers', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    useNotifications().clearAllNotifications()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the chosen answers in order and says when one is no longer published', async () => {
    mockServer([2, 99, 1])

    const view = renderSection()

    expect(await view.findByText('Reset your password')).toBeInTheDocument()
    expect(chosenTitles(view)).toEqual(['Reset your password', 'Connect to the Wi-Fi'])
    expect(view.getByRole('status')).toHaveTextContent('1 chosen answer is no longer published')
    expect(view.getByRole('button', { name: 'Save popular answers' })).toBeEnabled()
  })

  it('finds, adds, orders and removes answers, then saves them', async () => {
    const saves = mockServer([1])

    const view = renderSection()
    await view.findByText('Connect to the Wi-Fi')

    await view.events.type(view.getByLabelText('Add an answer'), 'how-to')
    const found = within(view.getByRole('list', { name: 'Answers found' }))

    expect(found.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      expect.stringContaining('Print from your laptop'),
    ])

    await view.events.click(found.getByRole('button', { name: 'Add Print from your laptop' }))
    await view.events.click(view.getByRole('button', { name: 'Move Print from your laptop up' }))

    expect(chosenTitles(view)).toEqual(['Print from your laptop', 'Connect to the Wi-Fi'])

    await view.events.click(view.getByRole('button', { name: 'Remove Connect to the Wi-Fi' }))
    await view.events.click(view.getByRole('button', { name: 'Save popular answers' }))

    expect(saves).toEqual([{ state_current: { value: [3] } }])
    await vi.waitFor(() => expect(lastNotification()).toBe('Popular answers saved.'))
    expect(view.getByRole('button', { name: 'Save popular answers' })).toBeDisabled()
  })

  it('stops offering answers at 5', async () => {
    mockServer([1, 2, 3, 4, 5])
    const view = renderSection()
    await view.findByText('Connect to the Wi-Fi')

    expect(view.queryByLabelText('Add an answer')).not.toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Remove Book a study room' }))

    expect(view.getByLabelText('Add an answer')).toBeInTheDocument()
  })

  it("shows the server's message when saving fails", async () => {
    mockServer([1], () => ({ status: 422, body: { error_human: 'Only answers published in the help center can be chosen.' } }))

    const view = renderSection()
    await view.findByText('Connect to the Wi-Fi')

    await view.events.click(view.getByRole('button', { name: 'Remove Connect to the Wi-Fi' }))
    await view.events.click(view.getByRole('button', { name: 'Save popular answers' }))

    await vi.waitFor(() =>
      expect(lastNotification()).toBe('Only answers published in the help center can be chosen.'),
    )
  })
})
