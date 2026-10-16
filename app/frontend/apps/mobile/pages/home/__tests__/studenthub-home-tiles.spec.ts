// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { visitView } from '#tests/support/components/visitView.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { mockTicketOverviews } from '#tests/support/mocks/ticket-overviews.ts'

const tileNames = async () => {
  const view = await visitView('/')
  const tiles = within(view.getByRole('navigation', { name: 'Shortcuts' })).getAllByRole('link')

  return { view, names: tiles.map((tile) => tile.textContent?.trim()) }
}

// Student Hub: the home page's tiles (design option 5).
describe('Student Hub home tiles', () => {
  beforeEach(() => {
    mockTicketOverviews()
  })

  it('shows every tile to staff who may read the Knowledge Base', async () => {
    mockPermissions(['ticket.agent', 'knowledge_base.reader'])

    const { view, names } = await tileNames()

    expect(names).toEqual(['New ticket', 'Ticket overviews', 'Notifications', 'Knowledge Base'])
    expect(view.getByRole('link', { name: 'New ticket' })).toHaveAttribute(
      'href',
      '/mobile/tickets/create',
    )
    expect(view.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
      'href',
      '/mobile/notifications',
    )
    // The Knowledge Base lives in the new UI, outside the mobile app.
    expect(view.getByRole('link', { name: 'Knowledge Base' })).toHaveAttribute(
      'href',
      '/knowledge-base',
    )
  })

  it('leaves out the tiles a student may not use', async () => {
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: false })

    const { names } = await tileNames()

    expect(names).toEqual(['Ticket overviews', 'Notifications'])
  })
})
