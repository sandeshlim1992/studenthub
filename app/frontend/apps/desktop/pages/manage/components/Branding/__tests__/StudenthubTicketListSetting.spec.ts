// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor, within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubTicketListSetting from '../StudenthubTicketListSetting.vue'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('StudenthubTicketListSetting', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((url: string, init: RequestInit = {}) => {
      if (init.method === 'PUT') return Promise.resolve(jsonResponse({}))
      if (url.startsWith('/api/v1/ticket_states')) {
        return Promise.resolve(
          jsonResponse([
            { id: 9, name: '5. Resolved', active: true, state_type: 'open' },
            { id: 1, name: '1. New', active: true, state_type: 'new' },
            { id: 7, name: '4.1 Pending / On Hold', active: true, state_type: 'pending reminder' },
            { id: 6, name: 'removed', active: false, state_type: 'removed' },
          ]),
        )
      }
      return Promise.resolve(
        jsonResponse([
          { id: 80, name: 'studenthub_ticket_state_colors', state_current: { value: { 1: 'blue', 9: 'green' } } },
          { id: 81, name: 'studenthub_escalation_warning_minutes', state_current: { value: 60 } },
        ]),
      )
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const renderLoaded = async () => {
    const view = renderComponent(StudenthubTicketListSetting)
    await waitFor(() => expect(view.getByLabelText('Show "due soon" before the SLA deadline')).toBeEnabled())
    return view
  }

  it('lists the active states in order with their saved or type colour', async () => {
    const view = await renderLoaded()

    const groups = view.getAllByRole('radiogroup')
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'Colour of 1. New',
      'Colour of 4.1 Pending / On Hold',
      'Colour of 5. Resolved',
    ])
    expect(within(groups[1]).getByRole('radio', { name: 'Amber' })).toHaveAttribute('aria-checked', 'true')
    expect(within(groups[2]).getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'true')
    expect(view.getByRole('button', { name: 'Save ticket list colours' })).toBeDisabled()
  })

  it('saves a changed colour for every listed state', async () => {
    const view = await renderLoaded()

    const resolved = view.getByRole('radiogroup', { name: 'Colour of 5. Resolved' })
    await view.events.click(within(resolved).getByRole('radio', { name: 'Teal' }))
    await view.events.click(view.getByRole('button', { name: 'Save ticket list colours' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/settings/80',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ state_current: { value: { 1: 'blue', 7: 'amber', 9: 'teal' } } }),
        }),
      ),
    )
    expect(fetchMock).not.toHaveBeenCalledWith('/api/v1/settings/81', expect.anything())
    expect(await view.findByText('Ticket list colours saved.')).toBeInTheDocument()
  })

  it('explains a missing permission instead of offering a Save that cannot work', async () => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url.startsWith('/api/v1/ticket_states')
            ? [{ id: 1, name: '1. New', active: true, state_type: 'new' }]
            : [{ id: 12, name: 'product_name', state_current: { value: 'Student Hub' } }],
        ),
      ),
    )

    const view = renderComponent(StudenthubTicketListSetting)

    expect(await view.findByText(/needs the "admin.branding" permission/)).toBeInTheDocument()
    expect(view.getByRole('radio', { name: 'Blue' })).toBeDisabled()
    expect(view.getByLabelText('Show "due soon" before the SLA deadline')).toBeDisabled()
    expect(view.getByRole('button', { name: 'Save ticket list colours' })).toBeDisabled()
  })

  it('saves the "due soon" point', async () => {
    const view = await renderLoaded()

    await view.events.selectOptions(view.getByLabelText('Show "due soon" before the SLA deadline'), '120')
    await view.events.click(view.getByRole('button', { name: 'Save ticket list colours' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/settings/81',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ state_current: { value: 120 } }) }),
      ),
    )
  })
})
