// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref } from 'vue'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { useTicketApproval } from '../useTicketApproval.ts'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('useTicketApproval', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads the status of the ticket', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ state: 'pending', can_decide: true }))
    vi.stubGlobal('fetch', fetchMock)

    const approval = useTicketApproval(ref(7001))
    await approval.load()

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/tickets/7001/approval')
    expect(approval.status.value).toMatchObject({ state: 'pending', can_decide: true })
  })

  it('sends decisions with the CSRF token', async () => {
    setCSRFToken('csrf-abc')
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ state: 'approved' }))
    vi.stubGlobal('fetch', fetchMock)

    const approval = useTicketApproval(ref(7001))
    const ok = await approval.approve('Go ahead')

    const [url, init] = fetchMock.mock.calls[0]
    expect(ok).toBe(true)
    expect(url).toBe('/api/v1/tickets/7001/approval/approve')
    expect(init.method).toBe('POST')
    expect(init.headers['X-CSRF-Token']).toBe('csrf-abc')
    expect(JSON.parse(init.body)).toEqual({ comment: 'Go ahead' })
    expect(approval.status.value?.state).toBe('approved')
  })

  it('keeps the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'Only the manager this ticket was sent to can decide.' }, 422)))

    const approval = useTicketApproval(ref(7001))
    const ok = await approval.deny('No')

    expect(ok).toBe(false)
    expect(approval.errorMessage.value).toBe('Only the manager this ticket was sent to can decide.')
  })

  it('withdraws with DELETE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ state: null }))
    vi.stubGlobal('fetch', fetchMock)

    await useTicketApproval(ref(7001)).withdraw()

    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})
