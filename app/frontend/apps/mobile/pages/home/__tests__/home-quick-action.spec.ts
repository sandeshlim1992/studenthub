// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { waitFor } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockTicketOverviews } from '#tests/support/mocks/ticket-overviews.ts'

describe('testing quick action', () => {
  beforeEach(() => {
    mockTicketOverviews()
  })

  it('ticket create quick action is present', async () => {
    mockPermissions(['ticket.agent'])

    const view = await visitView('/')

    // Student Hub: the quick action is the "New ticket" tile (design option 5).
    const newTicket = view.getByRole('link', { name: 'New ticket' })

    await view.events.click(newTicket)

    await waitFor(() => {
      expect(view.queryByText('Create ticket')).toBeInTheDocument()
    })
  })
})
