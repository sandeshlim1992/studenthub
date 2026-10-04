// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import renderComponent from '#tests/support/components/renderComponent.ts'

import FeedbackCollectionResponses from '../FeedbackCollectionResponses.vue'

import type { FeedbackItem } from '../types.ts'

const item = (overrides: Partial<FeedbackItem> = {}): FeedbackItem => ({
  id: 1,
  ticket_id: 42,
  ticket_number: '886835',
  ticket_title: 'Password Reset Request',
  customer_name: 'Jane',
  customer_email: 'jane@example.com',
  owner_name: 'Borice',
  group_name: 'Service Desk',
  state: 'submitted',
  source: 'native',
  sent_at: '2026-10-01T09:00:00Z',
  error: null,
  rating: 4,
  comments: 'Quick fix',
  rated_at: '2026-10-01T10:00:00Z',
  created_at: '2026-10-01T09:00:00Z',
  ...overrides,
})

const jsonResponse = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('FeedbackCollectionResponses', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      if (init.method === 'DELETE') return Promise.resolve(jsonResponse({}))
      return Promise.resolve(jsonResponse({ items: [item()], total: 1, page: 1, per_page: 25 }))
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists answered feedback with a link to the ticket', async () => {
    const view = renderComponent(FeedbackCollectionResponses)

    expect(await view.findByText('Quick fix')).toBeInTheDocument()
    expect(view.getByRole('link', { name: '#886835' })).toHaveAttribute('href', '/#ticket/zoom/42')
    expect(view.getByText('4/5')).toBeInTheDocument()
    expect(view.getByText('1–1 of 1')).toBeInTheDocument()
  })

  it('offers a CSV export of the current filters', async () => {
    const view = renderComponent(FeedbackCollectionResponses)
    await view.findByText('Quick fix')

    expect(view.getByRole('link', { name: /Export CSV/ })).toHaveAttribute(
      'href',
      '/api/v1/feedback_collection/export?state=submitted',
    )
  })

  it('deletes an entry only after confirming', async () => {
    const view = renderComponent(FeedbackCollectionResponses)
    await view.findByText('Quick fix')

    await view.events.click(view.getByRole('button', { name: 'Details' }))
    expect(view.getByRole('dialog')).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: /Delete/ }))
    expect(fetchMock).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'DELETE' }))
    expect(view.getByText("Delete this entry? This can't be undone.")).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: /^Delete$/ }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/feedback_collection/requests/1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  it('sorts by rating when the column header is clicked', async () => {
    const view = renderComponent(FeedbackCollectionResponses)
    await view.findByText('Quick fix')

    await view.events.click(view.getByRole('button', { name: 'Rating' }))

    await waitFor(() => expect(fetchMock.mock.calls.at(-1)?.[0]).toContain('sort_by=rating&order_by=desc'))
  })
})
