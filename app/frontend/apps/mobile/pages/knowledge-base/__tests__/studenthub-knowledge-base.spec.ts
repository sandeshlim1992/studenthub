// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { getTestRouter } from '#tests/support/components/renderComponent.ts'
import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

const api = '/api/v1/studenthub/mobile_app/knowledge_base'

const topTopics = {
  topic: null,
  topics: [
    { id: 7, title: 'IT & accounts', icon: 'f108', answer_count: 2 },
    { id: 9, title: 'Library & study', icon: 'f000', answer_count: 1 },
  ],
  answers: [],
}

const wifiTopic = {
  topic: { id: 8, title: 'Wi-Fi & devices', path: [{ id: 7, title: 'IT & accounts' }] },
  topics: [],
  answers: [{ id: 3, title: 'Connect to the Wi-Fi' }],
}

const wifiAnswer = {
  id: 3,
  title: 'Connect to the Wi-Fi',
  body: '<p>Sign in with your college email. <a href="/mobile/knowledge-base/answers/4">Forgot it?</a></p>',
  updated_at: '2026-10-01T10:00:00Z',
  path: [
    { id: 7, title: 'IT & accounts' },
    { id: 8, title: 'Wi-Fi & devices' },
  ],
  attachments: [{ id: 51, filename: 'eduroam.pdf', size: 2048 }],
  helpful: null,
}

const passwordAnswer = {
  ...wifiAnswer,
  id: 4,
  title: 'Reset your password',
  body: '<p>Use the reset page.</p>',
  attachments: [],
}

type Reply = unknown | ((init?: RequestInit) => unknown)

const mockApi = (replies: Record<string, Reply>) => {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (!(url in replies)) return new Response('{}', { status: 404 })

    const reply = replies[url]
    const body = typeof reply === 'function' ? reply(init) : reply
    return new Response(JSON.stringify(body))
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Student Hub: Help articles in the mobile app (design 1 "Topics").
describe('Student Hub Help articles', () => {
  beforeEach(() => {
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: true })
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the topics with how many answers each has', async () => {
    mockApi({ [api]: topTopics })

    const view = await visitView('/knowledge-base')
    const topics = within(await view.findByRole('region', { name: 'Topics' }))

    expect(view.getByRole('heading', { level: 1, name: 'Help articles' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/mobile/')
    expect(topics.getByRole('link', { name: /IT & accounts/ })).toHaveAttribute(
      'href',
      '/mobile/knowledge-base/7',
    )
    expect(topics.getByRole('link', { name: /IT & accounts/ })).toHaveTextContent('2 answers')
    expect(topics.getByRole('link', { name: /Library & study/ })).toHaveTextContent('1 answer')
  })

  it('shows a topic with the topics above it and its answers', async () => {
    mockApi({ [`${api}/categories/8`]: wifiTopic })

    const view = await visitView('/knowledge-base/8')
    const answers = within(await view.findByRole('region', { name: 'Answers' }))

    expect(view.getByRole('heading', { level: 1, name: 'Wi-Fi & devices' })).toBeInTheDocument()
    expect(view.getByText('Help articles › IT & accounts')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Back to IT & accounts' })).toHaveAttribute(
      'href',
      '/mobile/knowledge-base/7',
    )
    expect(answers.getByRole('link', { name: 'Connect to the Wi-Fi' })).toHaveAttribute(
      'href',
      '/mobile/knowledge-base/answers/3',
    )
    expect(view.queryByRole('region', { name: 'Topics' })).not.toBeInTheDocument()
  })

  it('says so when a topic is not available', async () => {
    mockApi({})

    const view = await visitView('/knowledge-base/99')

    expect(await view.findByText('These help articles are not available.')).toBeInTheDocument()
  })

  it('searches every published answer once a few letters are typed', async () => {
    const fetchMock = mockApi({
      [api]: topTopics,
      [`${api}/search?query=wi-fi`]: [
        {
          id: 3,
          title: 'Connect to the Wi-Fi',
          topic: 'Wi-Fi & devices',
          snippet: 'Sign in with…',
        },
      ],
    })

    const view = await visitView('/knowledge-base')
    await view.findByRole('region', { name: 'Topics' })

    await view.events.type(view.getByRole('searchbox', { name: 'Search help articles' }), 'wi-fi')
    const results = within(await view.findByRole('region', { name: 'Search results' }))

    expect(results.getByRole('link', { name: /Connect to the Wi-Fi/ })).toHaveAttribute(
      'href',
      '/mobile/knowledge-base/answers/3',
    )
    expect(view.queryByRole('region', { name: 'Topics' })).not.toBeInTheDocument()
    // Typing quickly, it searches once the student stops.
    expect(fetchMock).not.toHaveBeenCalledWith(`${api}/search?query=wi`, expect.anything())
  })

  it('shows an answer with its files, and takes the vote of a student', async () => {
    const fetchMock = mockApi({
      [`${api}/answers/3`]: wifiAnswer,
      [`${api}/answers/3/feedback`]: (init?: RequestInit) => JSON.parse(String(init?.body)),
    })

    const view = await visitView('/knowledge-base/answers/3')

    expect(
      await view.findByRole('heading', { level: 1, name: 'Connect to the Wi-Fi' }),
    ).toBeInTheDocument()
    expect(view.getByText('Help articles › IT & accounts › Wi-Fi & devices')).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Back to Wi-Fi & devices' })).toHaveAttribute(
      'href',
      '/mobile/knowledge-base/8',
    )
    expect(view.getByRole('article', { name: 'Connect to the Wi-Fi' })).toHaveTextContent(
      'Sign in with your college email.',
    )
    expect(view.getByRole('link', { name: /eduroam.pdf/ })).toHaveAttribute(
      'href',
      '/api/v1/attachments/51?disposition=attachment',
    )
    expect(view.getByRole('link', { name: /Still need help/ })).toHaveAttribute(
      'href',
      '/mobile/tickets/request',
    )

    const no = view.getByRole('button', { name: 'No' })
    expect(no).toHaveAttribute('aria-pressed', 'false')

    await view.events.click(no)

    expect(await view.findByRole('status')).toHaveTextContent('Thank you for telling us.')
    expect(no).toHaveAttribute('aria-pressed', 'true')
    expect(fetchMock).toHaveBeenCalledWith(
      `${api}/answers/3/feedback`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ helpful: false }) }),
    )
  })

  it('opens links to other answers in the app, without the vote given on the first', async () => {
    mockApi({
      [`${api}/answers/3`]: wifiAnswer,
      [`${api}/answers/4`]: passwordAnswer,
      [`${api}/answers/3/feedback`]: { helpful: true },
    })

    const view = await visitView('/knowledge-base/answers/3')
    await view.events.click(await view.findByRole('button', { name: 'Yes' }))
    expect(await view.findByText('Thank you for telling us.')).toBeInTheDocument()

    await view.events.click(view.getByRole('link', { name: 'Forgot it?' }))

    expect(
      await view.findByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeInTheDocument()
    expect(view.queryByText('Thank you for telling us.')).not.toBeInTheDocument()
  })

  it('keeps the answer opened last when an earlier one answers late', async () => {
    let answerLate: (response: Response) => void = () => {}
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        if (url === `${api}/answers/3`)
          return new Promise<Response>((resolve) => {
            answerLate = resolve
          })
        return Promise.resolve(new Response(JSON.stringify(passwordAnswer)))
      }),
    )

    const view = await visitView('/knowledge-base/answers/3')
    await getTestRouter().push('/knowledge-base/answers/4')
    await view.findByRole('heading', { level: 1, name: 'Reset your password' })

    answerLate(new Response(JSON.stringify(wifiAnswer)))

    await vi.waitFor(() =>
      expect(
        view.getByRole('heading', { level: 1, name: 'Reset your password' }),
      ).toBeInTheDocument(),
    )
  })

  it('says so when a vote cannot be saved', async () => {
    mockApi({ [`${api}/answers/3`]: wifiAnswer })

    const view = await visitView('/knowledge-base/answers/3')
    await view.events.click(await view.findByRole('button', { name: 'No' }))

    expect(
      await view.findByText('Your answer could not be saved. Please try again.'),
    ).toHaveAttribute('role', 'alert')
    expect(view.getByRole('button', { name: 'No' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('asks only students whether an answer helped', async () => {
    mockPermissions(['ticket.agent'])
    mockApi({ [`${api}/answers/3`]: wifiAnswer })

    const view = await visitView('/knowledge-base/answers/3')
    await view.findByRole('heading', { level: 1, name: 'Connect to the Wi-Fi' })

    expect(view.queryByRole('region', { name: 'Was this helpful?' })).not.toBeInTheDocument()
    expect(view.queryByRole('link', { name: /Still need help/ })).not.toBeInTheDocument()
  })
})
