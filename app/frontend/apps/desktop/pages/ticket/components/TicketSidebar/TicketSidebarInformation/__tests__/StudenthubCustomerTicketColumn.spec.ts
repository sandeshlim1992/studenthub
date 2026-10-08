// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import type { StudenthubCustomerTicketOverview } from '#desktop/utils/studenthubCustomerTicket.ts'

import StudenthubCustomerTicketColumn from '../TicketSidebarInformationContent/StudenthubCustomerTicketColumn.vue'

const mocks = vi.hoisted(() => ({ openReplyForm: vi.fn(), confirm: vi.fn() }))

vi.mock('#desktop/pages/ticket/composables/useTicketInformation.ts', () => ({
  useTicketInformation: () => ({ form: ref(), showTicketArticleReplyForm: vi.fn() }),
}))

vi.mock('#shared/entities/ticket/composables/useTicketArticleReplyAction.ts', () => ({
  useTicketArticleReplyAction: () => ({ openReplyForm: mocks.openReplyForm }),
}))

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForConfirmation: mocks.confirm }),
}))

const overview = (changes: Partial<StudenthubCustomerTicketOverview> = {}): StudenthubCustomerTicketOverview => ({
  id: 7007,
  number: '886843',
  title: 'Exam extension form will not submit',
  team: 'Service Desk',
  created_at: '2026-10-04T09:00:00Z',
  last_team_reply_at: null,
  fields: [
    { name: 'category2', label: 'Category', value: 'Service Request › Password Reset' },
    { name: 'campus', label: 'Campus', value: 'FSB Sheffield' },
  ],
  progress: { stage: 'waiting_for_you', step: 2 },
  files: [],
  actions: { can_close: true, can_reopen: false, new_ticket: false },
  feedback: null,
  ...changes,
})

const mockServer = (routes: Record<string, () => unknown>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined })
      const handler = routes[`${method} ${url}`]
      if (!handler) return new Response(JSON.stringify({ error: `No mock for ${method} ${url}` }), { status: 404 })
      return new Response(JSON.stringify(handler()))
    }),
  )
  return calls
}

const renderColumn = () =>
  renderComponent(StudenthubCustomerTicketColumn, {
    props: { ticket: { internalId: 7007, updatedAt: '2026-10-07T10:00:00Z' }, modelValue: {} },
    router: true,
    store: true,
  })

const path = '/api/v1/studenthub/customer_tickets/7007'

describe('Student column on the ticket screen', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    mocks.openReplyForm.mockReset()
    mocks.confirm.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the request, where it stands and opens the reply when the team waits for the student', async () => {
    mockServer({ [`GET ${path}`]: () => overview() })

    const view = renderColumn()

    const summary = await view.findByTestId('studenthub-customer-summary')
    expect(summary).toHaveTextContent('#886843')
    expect(summary).toHaveTextContent('Service Request › Password Reset')
    expect(summary).toHaveTextContent('FSB Sheffield')
    expect(summary).toHaveTextContent('Service Desk')
    expect(summary).toHaveTextContent('No reply yet')

    const current = view.getByTestId('studenthub-customer-progress').querySelector('[aria-current="step"]')
    expect(current).toHaveTextContent('Being worked on')
    expect(view.getByRole('status')).toHaveTextContent('Waiting for you')

    await view.events.click(view.getByRole('button', { name: 'Reply' }))
    expect(mocks.openReplyForm).toHaveBeenCalledWith({ articleType: 'web', internal: false })
  })

  it('lists the shared files with a download link', async () => {
    mockServer({
      [`GET ${path}`]: () =>
        overview({
          files: [
            {
              id: 11,
              article_id: 5,
              filename: 'extension-form.pdf',
              size: 2048,
              content_type: 'application/pdf',
              from_team: true,
              created_at: '2026-10-05T09:00:00Z',
              url: '/api/v1/ticket_attachment/7007/5/11?disposition=attachment',
            },
          ],
        }),
    })

    const view = renderColumn()

    const link = await view.findByRole('link', { name: 'extension-form.pdf' })
    expect(link).toHaveAttribute('href', '/api/v1/ticket_attachment/7007/5/11?disposition=attachment')
    expect(view.getByTestId('studenthub-customer-files')).toHaveTextContent('From the team')
  })

  it('closes the request after the student confirms', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () => overview(),
      [`POST ${path}/close`]: () =>
        overview({
          progress: { stage: 'closed', step: 4 },
          actions: { can_close: false, can_reopen: true, new_ticket: false },
        }),
    })

    const view = renderColumn()

    await view.events.click(await view.findByRole('button', { name: 'I no longer need help' }))

    expect(mocks.confirm).toHaveBeenCalled()
    expect(await view.findByRole('button', { name: 'Still not fixed? Reopen' })).toBeInTheDocument()
    expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: `${path}/close` })
    expect(view.getByRole('status')).toHaveTextContent('Closed')
  })

  it('reopens with what is still not working', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () =>
        overview({
          progress: { stage: 'resolved', step: 3 },
          actions: { can_close: true, can_reopen: true, new_ticket: false },
        }),
      [`POST ${path}/reopen`]: () => overview({ progress: { stage: 'in_progress', step: 2 } }),
    })

    const view = renderColumn()

    expect(await view.findByRole('button', { name: 'Yes, it is fixed: close it' })).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Still not fixed? Reopen' }))
    await view.events.type(view.getByLabelText('What is still not working?'), 'Still broken')
    await view.events.click(view.getByRole('button', { name: 'Reopen request' }))

    await vi.waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')).toEqual({
        method: 'POST',
        url: `${path}/reopen`,
        body: { message: 'Still broken' },
      }),
    )
    expect(await view.findByRole('button', { name: 'I no longer need help' })).toBeInTheDocument()
  })

  it('rates the support once the request is closed', async () => {
    const calls = mockServer({
      [`GET ${path}`]: () =>
        overview({
          progress: { stage: 'closed', step: 4 },
          actions: { can_close: false, can_reopen: true, new_ticket: false },
          feedback: { state: 'awaiting' },
        }),
      [`POST ${path}/rating`]: () =>
        overview({
          progress: { stage: 'closed', step: 4 },
          actions: { can_close: false, can_reopen: true, new_ticket: false },
          feedback: { state: 'submitted', rating: 4, comments: 'Quick help', rated_at: '2026-10-07T10:00:00Z' },
        }),
    })

    const view = renderColumn()

    await view.events.click(await view.findByLabelText('4 of 5 stars'))
    await view.events.type(view.getByLabelText('Anything to add? (optional)'), 'Quick help')
    await view.events.click(view.getByRole('button', { name: 'Send rating' }))

    expect(await view.findByText('You rated our support')).toBeInTheDocument()
    expect(view.getByRole('img', { name: '4 of 5 stars' })).toHaveTextContent('★★★★☆')
    expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ rating: 4, comments: 'Quick help' })
  })

  it('offers a new ticket when the closed request cannot be reopened', async () => {
    mockServer({
      [`GET ${path}`]: () =>
        overview({
          progress: { stage: 'closed', step: 4 },
          actions: { can_close: false, can_reopen: false, new_ticket: true },
        }),
    })

    const view = renderColumn()

    expect(await view.findByRole('button', { name: 'Raise a New Ticket' })).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Still not fixed? Reopen' })).not.toBeInTheDocument()
  })
})
