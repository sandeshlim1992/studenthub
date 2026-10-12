// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { keepSettings, noKeptSettings, withKeptSettings } from '../keptSettings.ts'

describe('kept settings of the simple admin editors', () => {
  const shown = ['ticket.state_id', 'ticket.group_id']

  it('keeps what the editor does not show and saves it back with the editor own keys', () => {
    const kept = keepSettings(
      {
        'ticket.state_id': { operator: 'is', value: ['2'] },
        'ticket.subcategory': { operator: 'is', value: ['Onboarding'] },
        'notification.email': { recipient: ['ticket_customer'], subject: 'Hi', body: 'Hello' },
      },
      shown,
    )

    expect(kept).toEqual({
      expert: null,
      kept: {
        'ticket.subcategory': { operator: 'is', value: ['Onboarding'] },
        'notification.email': { recipient: ['ticket_customer'], subject: 'Hi', body: 'Hello' },
      },
    })

    expect(withKeptSettings(kept, { 'ticket.group_id': { operator: 'is', value: ['3'] } })).toEqual(
      {
        'ticket.subcategory': { operator: 'is', value: ['Onboarding'] },
        'notification.email': { recipient: ['ticket_customer'], subject: 'Hi', body: 'Hello' },
        'ticket.group_id': { operator: 'is', value: ['3'] },
      },
    )
  })

  it('leaves expert-mode conditions as they were', () => {
    const expert = {
      operator: 'AND',
      conditions: [{ name: 'ticket.state_id', operator: 'is', value: ['2'] }],
    }
    const kept = keepSettings(expert, shown)

    expect(kept).toEqual({ expert, kept: {} })
    expect(withKeptSettings(kept, { 'ticket.state_id': { operator: 'is', value: ['4'] } })).toBe(
      expert,
    )
  })

  it('keeps nothing for a new record', () => {
    expect(keepSettings(undefined, shown)).toEqual(noKeptSettings())
    expect(withKeptSettings(noKeptSettings(), { 'ticket.state_id': { value: '4' } })).toEqual({
      'ticket.state_id': { value: '4' },
    })
  })
})
