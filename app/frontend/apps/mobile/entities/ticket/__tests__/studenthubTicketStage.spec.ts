// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  isStudenthubTicketDone,
  studenthubTicketStage,
} from '#mobile/entities/ticket/helpers/studenthubTicketStage.ts'

const state = (name: string, stateType: string) => ({ name, stateType: { name: stateType } })

describe('studenthubTicketStage', () => {
  it.each([
    ['1. New', 'new', 'new'],
    ['2. Assigned', 'open', 'progress'],
    ['3. In Progress', 'open', 'progress'],
    ['4.1 Pending / On Hold', 'pending reminder', 'progress'],
    ['4. Awaiting user Response', 'open', 'waiting'],
    ['5. Resolved', 'open', 'resolved'],
    ['6. Closed', 'closed', 'closed'],
    ['merged', 'merged', 'closed'],
  ])('puts "%s" (%s) at %s', (name, stateType, stage) => {
    expect(studenthubTicketStage(state(name, stateType))).toBe(stage)
  })

  it('counts resolved and closed tickets as done', () => {
    expect(isStudenthubTicketDone('resolved')).toBe(true)
    expect(isStudenthubTicketDone('closed')).toBe(true)
    expect(isStudenthubTicketDone('waiting')).toBe(false)
  })
})
