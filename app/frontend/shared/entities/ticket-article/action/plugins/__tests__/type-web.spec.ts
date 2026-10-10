// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { createTestArticleTypes, createTicket } from './utils.ts'

describe('web type', () => {
  it('customer does get web type', () => {
    mockPermissions(['ticket.customer'])
    const ticket = createTicket()

    const types = createTestArticleTypes(ticket)

    expect(types).toContainEqual(expect.objectContaining({ value: 'web' }))
  })

  // Student Hub: agents reply on the web too (the reply box's Email / Web choice).
  it('agent does get web type', () => {
    mockPermissions(['ticket.agent'])
    const ticket = createTicket()

    const types = createTestArticleTypes(ticket)

    expect(types).toContainEqual(expect.objectContaining({ value: 'web' }))
  })
})
