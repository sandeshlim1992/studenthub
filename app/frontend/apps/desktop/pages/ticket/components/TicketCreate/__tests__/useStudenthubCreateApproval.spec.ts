// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'

import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'

import { useStudenthubCreateApproval } from '../useStudenthubCreateApproval.ts'

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })

describe('useStudenthubCreateApproval', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    useNotifications().clearAllNotifications()
  })

  it('lists every manager, whatever the team', async () => {
    // A response body can be read once: a new one per call.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          managers: [
            { id: 3, name: 'Test Manager' },
            { id: 4, name: 'Other Manager' },
          ],
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { managerOptions, managerHint } = useStudenthubCreateApproval(ref(true))
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/ticket_approval/managers', expect.anything())
    expect(managerOptions.value).toEqual([
      { value: 3, label: 'Test Manager' },
      { value: 4, label: 'Other Manager' },
    ])
    expect(managerHint.value).toBeUndefined()
  })

  it('says so when nobody has the Managers role', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ managers: [] })))

    const { managerHint } = useStudenthubCreateApproval(ref(true))
    await flushPromises()

    expect(managerHint.value).toMatch(/Nobody has the Managers role/)
  })

  it('sends the request once the ticket exists, and says so when it fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ managers: [] }))
      .mockResolvedValueOnce(jsonResponse({}))
      .mockResolvedValueOnce(jsonResponse({ error: 'The manager cannot open this ticket.' }, 422))
    vi.stubGlobal('fetch', fetchMock)

    const { sendForApproval } = useStudenthubCreateApproval(ref(true))
    await flushPromises()

    await sendForApproval(42, { send: true, approverId: 3, reason: 'New laptop' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/tickets/42/approval',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ approver_id: 3, reason: 'New laptop' }),
      }),
    )
    expect(useNotifications().notifications.value.at(-1)).toMatchObject({
      message: 'Ticket sent for approval.',
    })

    await sendForApproval(42, { send: true, approverId: 3, reason: 'New laptop' })

    expect(useNotifications().notifications.value.at(-1)).toMatchObject({
      messagePlaceholder: ['The manager cannot open this ticket.'],
    })
  })
})
