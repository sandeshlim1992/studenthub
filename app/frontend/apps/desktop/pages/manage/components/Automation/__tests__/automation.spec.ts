// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  actionFields,
  actionProblems,
  conditionFields,
  conditionProblems,
  conditionToRows,
  emptyAction,
  emptyCondition,
  isExpertCondition,
  performToRows,
  rowsToCondition,
  rowsToPerform,
  type AutomationOptions,
} from '../automation.ts'

const options: AutomationOptions = {
  states: [
    { id: 3, name: 'pending reminder', active: true },
    { id: 4, name: 'closed', active: true },
  ],
  priorities: [{ id: 2, name: 'P3 - Normal', active: true }],
  groups: [{ id: 26, name: 'Service Desk', active: true }],
  agents: [{ id: 7, name: 'Test Agent', active: true }],
  organizations: [],
  webhooks: [{ id: 16, name: 'Survey', active: true }],
  ticket_attributes: [
    {
      name: 'campus',
      display: 'Campus',
      data_type: 'tree_select',
      active: true,
      options: [{ value: 'LSST', label: 'LSST' }],
    },
  ],
}

const fields = conditionFields(options)
const actions = actionFields(options)

// A job from the test server: "Change Resolved ticket to Closed and Survey Email".
const condition = {
  'ticket.state_id': { operator: 'is', value: ['9'] },
  'ticket.updated_at': { operator: 'before (relative)', value: '1', range: 'day' },
  'ticket.tags': { operator: 'contains one not', value: 'survey_sent, closed-notified, spam' },
}
const perform = {
  'article.note': { body: 'Ticket automatically closed.', internal: 'true', subject: 'Ticket closed' },
  'notification.webhook': { webhook_id: '16' },
  'ticket.state_id': { value: '4' },
  'ticket.tags': { operator: 'add', value: 'closed-notified, survey_sent' },
}

describe('automation conditions and actions', () => {
  it('turns a job into rows and back without changes', () => {
    expect(rowsToCondition(conditionToRows(condition, fields), fields)).toEqual(condition)
    expect(rowsToPerform(performToRows(perform, actions), actions)).toEqual(perform)
  })

  it('keeps what the editor does not know as it is', () => {
    const unknown = {
      'ticket.escalation_at': { operator: 'has reached', value: [] },
      'ticket.some_new_field': { operator: 'is', value: ['x'] },
    }
    const rows = conditionToRows(unknown, fields)

    expect(rows.every((row) => row.raw !== undefined)).toBe(true)
    expect(rowsToCondition(rows, fields)).toEqual(unknown)

    const email = {
      'notification.email': {
        recipient: ['ticket_customer'],
        subject: 'Hi',
        body: '<p>Text</p>',
        include_attachments: 'true',
      },
      'notification.sms': { recipient: ['ticket_customer'], body: 'Hi' },
    }
    expect(rowsToPerform(performToRows(email, actions), actions)).toEqual(email)
  })

  it('writes owner conditions and actions the way Zammad expects', () => {
    const owner = fields.find((field) => field.key === 'ticket.owner_id')!
    const unassigned = { ...emptyCondition(owner), preCondition: 'not_set' }
    expect(rowsToCondition([unassigned], fields)).toEqual({
      'ticket.owner_id': { operator: 'is', pre_condition: 'not_set', value: [] },
    })

    const setOwner = { ...emptyAction(actions.find((field) => field.key === 'ticket.owner_id')!), value: '7' }
    expect(rowsToPerform([setOwner], actions)).toEqual({
      'ticket.owner_id': { pre_condition: 'specific', value: '7', value_completion: '' },
    })
  })

  it('names what is missing before saving', () => {
    const state = emptyCondition(fields.find((field) => field.key === 'ticket.state_id')!)
    expect(conditionProblems([state], fields)).toEqual(['State: choose at least one.'])

    const email = emptyAction(actions.find((field) => field.key === 'notification.email')!)
    expect(actionProblems([email], actions)).toEqual([
      'Send an email: choose recipients and enter a subject and a text.',
    ])
    expect(actionProblems([{ ...email, subject: 'Hi', body: 'Text' }], actions)).toEqual([])
  })

  it('recognises expert-mode conditions', () => {
    expect(isExpertCondition({ operator: 'AND', conditions: [] })).toBe(true)
    expect(isExpertCondition(condition)).toBe(false)
  })
})
