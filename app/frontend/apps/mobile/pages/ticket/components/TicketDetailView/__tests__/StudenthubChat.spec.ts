// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, defineComponent, h, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import type { TicketById } from '#shared/entities/ticket/types.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'
import type { StudenthubCustomerTicketOverview } from '#shared/utils/studenthubCustomerTicket.ts'

import { provideStudenthubCustomerTicket } from '../../../composable/useStudenthubCustomerTicket.ts'
import StudenthubChatComposer from '../StudenthubChatComposer.vue'
import StudenthubChatHeader from '../StudenthubChatHeader.vue'
import StudenthubSolvedCard from '../StudenthubSolvedCard.vue'

const ticket = {
  internalId: 7004,
  number: '886843',
  title: "Exam extension form won't submit",
  updatedAt: '2026-10-10T09:00:00Z',
  organization: { name: 'FSB' },
  state: { name: '6. Closed' },
} as unknown as TicketById

const overview = (
  changes: Partial<StudenthubCustomerTicketOverview> = {},
): StudenthubCustomerTicketOverview => ({
  id: 7004,
  number: '886843',
  title: "Exam extension form won't submit",
  team: 'Student Services',
  created_at: '2026-10-09T10:42:00Z',
  last_team_reply_at: '2026-10-09T14:05:00Z',
  fields: [],
  progress: { stage: 'in_progress', step: 2 },
  files: [],
  actions: { can_close: true, can_reopen: false, new_ticket: false },
  feedback: null,
  ...changes,
})

const closed = (changes: Partial<StudenthubCustomerTicketOverview> = {}) =>
  overview({
    progress: { stage: 'closed', step: 4 },
    actions: { can_close: false, can_reopen: true, new_ticket: false },
    ...changes,
  })

const path = '/api/v1/studenthub/customer_tickets/7004'

const mockServer = (routes: Record<string, () => unknown>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
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
      if (!handler)
        return new Response(JSON.stringify({ error: `No mock for ${method} ${url}` }), {
          status: 404,
        })
      return new Response(JSON.stringify(handler()))
    }),
  )
  return calls
}

const attach = vi.fn()

// The chat as TicketDetailView and TicketDetailArticlesView put it together.
const StudenthubChat = defineComponent({
  setup() {
    provideStudenthubCustomerTicket(
      computed(() => ticket),
      ref(true),
    )

    return () => [
      h(StudenthubChatHeader, { ticket }),
      h(StudenthubSolvedCard),
      h(StudenthubChatComposer, { canAttach: true, onAttach: attach }),
    ]
  },
})

const renderChat = () => renderComponent(StudenthubChat, { router: true, store: true })

describe('Student chat on the mobile ticket screen', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    attach.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the request and where it stands in the header', async () => {
    mockServer({ [`GET ${path}`]: () => overview() })

    const view = renderChat()

    const header = view.getByTestId('studenthub-chat-header')
    expect(header).toHaveTextContent("Exam extension form won't submit")
    await vi.waitFor(() => expect(header).toHaveTextContent('#886843 · FSB · Being worked on'))
    expect(view.getByRole('link', { name: 'Ticket details' })).toHaveAttribute(
      'href',
      '/tickets/7004/information',
    )
  })

  it('sends a message from the chat box and empties it', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () => overview(),
      [`POST ${path}/reply`]: () => overview(),
    })

    const view = renderChat()

    const send = view.getByRole('button', { name: 'Send' })
    expect(send).toBeDisabled()

    const message = view.getByRole('textbox', { name: 'Message' })
    await view.events.type(message, 'My student number is 12345')
    await view.events.click(send)

    await vi.waitFor(() => expect(message).toHaveValue(''))
    expect(calls).toContainEqual({
      method: 'POST',
      url: `${path}/reply`,
      body: { message: 'My student number is 12345' },
    })
    expect(view.queryByTestId('studenthub-solved-card')).not.toBeInTheDocument()
  })

  it('keeps the message when it cannot be sent', async () => {
    const calls = mockServer({ [`GET ${path}`]: () => overview() })

    const view = renderChat()

    const message = view.getByRole('textbox', { name: 'Message' })
    await view.events.type(message, 'Hello')
    await view.events.click(view.getByRole('button', { name: 'Send' }))

    await vi.waitFor(() => expect(view.getByRole('button', { name: 'Send' })).toBeEnabled())
    expect(calls.map(({ method, url }) => `${method} ${url}`)).toContain(`POST ${path}/reply`)
    expect(message).toHaveValue('Hello')
  })

  it('opens Zammad’s reply form for files', async () => {
    mockServer({ [`GET ${path}`]: () => overview() })

    const view = renderChat()

    await view.events.click(view.getByRole('button', { name: 'Attach a file' }))

    expect(attach).toHaveBeenCalled()
  })

  it('closes a resolved request when the student says it is solved', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () => overview({ progress: { stage: 'resolved', step: 3 } }),
      [`POST ${path}/close`]: () => closed(),
    })

    const view = renderChat()

    expect(await view.findByText('Did this solve your problem?')).toBeInTheDocument()
    await view.events.click(view.getByRole('button', { name: 'Yes, thanks' }))

    expect(await view.findByText('Glad it is sorted. Thank you!')).toBeInTheDocument()
    expect(calls.map(({ method, url }) => `${method} ${url}`)).toContain(`POST ${path}/close`)
  })

  it('asks for the rating Feedback Collection is waiting for', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () => closed({ feedback: { state: 'awaiting' } }),
      [`POST ${path}/rating`]: () =>
        closed({
          feedback: { state: 'submitted', rating: 4, comments: null, rated_at: '2026-10-16' },
        }),
    })

    const view = renderChat()

    await view.events.click(await view.findByRole('button', { name: 'Yes, thanks' }))
    await view.events.click(view.getByRole('button', { name: '4 of 5 stars' }))

    expect(await view.findByText('You rated our support')).toBeInTheDocument()
    expect(view.getByRole('img', { name: '4 of 5 stars' })).toHaveTextContent('★★★★☆')
    expect(calls).toContainEqual({ method: 'POST', url: `${path}/rating`, body: { rating: 4 } })
  })

  it('hands over to the chat box when the problem is not solved', async () => {
    mockServer({ [`GET ${path}`]: () => closed() })

    const view = renderChat()

    expect(await view.findByText('Sending a message opens this request again.')).toBeInTheDocument()
    await view.events.click(view.getByRole('button', { name: 'No, still not fixed' }))

    expect(view.queryByTestId('studenthub-solved-card')).not.toBeInTheDocument()
    const message = view.getByRole('textbox', { name: 'Message' })
    expect(message).toHaveAttribute('placeholder', 'Tell us what is still not working…')
    await vi.waitFor(() => expect(message).toHaveFocus())
  })

  it('offers a new ticket when the request cannot be reopened', async () => {
    mockServer({
      [`GET ${path}`]: () =>
        closed({ actions: { can_close: false, can_reopen: false, new_ticket: true } }),
    })

    const view = renderChat()

    expect(
      await view.findByText(
        'This request is closed and cannot be reopened. Raise a new ticket if you still need help.',
      ),
    ).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'New ticket' })).toHaveAttribute(
      'href',
      '/tickets/create',
    )
    expect(view.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
  })
})
