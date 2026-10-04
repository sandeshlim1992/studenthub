// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { feedbackApi } from '../api.ts'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('feedbackApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends the CSRF token with changing requests only', async () => {
    setCSRFToken('csrf-123')
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({})))
    vi.stubGlobal('fetch', fetchMock)

    await feedbackApi.remove(7)
    await feedbackApi.report()

    const [deleteUrl, deleteInit] = fetchMock.mock.calls[0]
    expect(deleteUrl).toBe('/api/v1/feedback_collection/requests/7')
    expect(deleteInit.method).toBe('DELETE')
    expect(deleteInit.headers['X-CSRF-Token']).toBe('csrf-123')

    const [, reportInit] = fetchMock.mock.calls[1]
    expect(reportInit.headers['X-CSRF-Token']).toBeUndefined()
  })

  it('builds list queries without empty filters', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [], total: 0, page: 1, per_page: 25 }))
    vi.stubGlobal('fetch', fetchMock)

    await feedbackApi.list({
      page: 2,
      per_page: 25,
      sort_by: 'rating',
      order_by: 'asc',
      state: 'submitted',
      rating: '',
      query: '',
    })

    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/v1/feedback_collection/requests?page=2&per_page=25&sort_by=rating&order_by=asc&state=submitted',
    )
  })

  it('throws the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'No email channel is selected.' }, 422)))

    await expect(feedbackApi.testEmail('a@example.com')).rejects.toThrow('No email channel is selected.')
  })
})
