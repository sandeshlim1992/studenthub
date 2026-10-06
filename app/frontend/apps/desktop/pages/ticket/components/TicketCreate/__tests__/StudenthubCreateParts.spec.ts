// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import StudenthubPriorityButtons from '../StudenthubPriorityButtons.vue'
import StudenthubSlaPreview from '../StudenthubSlaPreview.vue'

const jsonResponse = (data: unknown) =>
  new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('New ticket screen parts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the priorities as buttons and reports the chosen one', async () => {
    const onSelect = vi.fn()
    const view = renderComponent(StudenthubPriorityButtons, {
      props: {
        label: 'Priority',
        value: 5,
        onSelect,
        options: [
          { value: 6, label: 'None' },
          { value: 4, label: 'P1  - Critical' },
          { value: 5, label: 'P3 - Normal' },
          { value: 1, label: 'P4 - Low' },
        ],
      },
    })

    const group = view.getByRole('group', { name: 'Priority' })
    // "None" (no priority yet) has no button.
    expect(group).toHaveTextContent(/^CriticalNormalLow$/)
    expect(view.getByRole('button', { name: 'Normal' })).toHaveAttribute('aria-pressed', 'true')

    await view.events.click(view.getByRole('button', { name: 'Critical' }))
    expect(onSelect).toHaveBeenCalledWith(4)
  })

  it('shows the SLA the new ticket would get', async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        jsonResponse({
          status: 'match',
          sla: {
            name: 'SLA: P1 Priority',
            first_response_time: null,
            update_time: null,
            solution_time: 180,
            calendar: 'UK Calendar',
          },
        }),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const view = renderComponent(StudenthubSlaPreview, {
      props: { priorityId: 4, groupId: 26, stateId: 2 },
    })

    expect(await view.findByText('3 working hours')).toBeInTheDocument()
    expect(view.getByText('Resolution')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/studenthub/sla_preview?priority_id=4&group_id=26&state_id=2',
      expect.anything(),
    )
  })
})
