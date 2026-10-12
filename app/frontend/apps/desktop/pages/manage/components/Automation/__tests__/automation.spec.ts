// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import {
  actionFields,
  actionProblems,
  conditionFields,
  conditionProblems,
  conditionStateProblems,
  conditionToRows,
  conditionToState,
  emptyAction,
  emptyCondition,
  groupToRows,
  isExpertCondition,
  newGroup,
  performToRows,
  rowsToCondition,
  rowsToGroup,
  rowsToPerform,
  stateRows,
  stateToCondition,
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

describe('trigger conditions, expert mode and the other actions', () => {
  const triggerOptions: AutomationOptions = {
    ...options,
    article_senders: [
      { id: 1, name: 'Agent', active: true },
      { id: 2, name: 'Customer', active: true },
    ],
    article_types: [{ id: 11, name: 'web', active: true }],
  }
  const triggerFields = conditionFields(triggerOptions, 'trigger')
  const triggerActions = actionFields(triggerOptions, 'trigger')
  const macroActions = actionFields(triggerOptions, 'macro')

  // Trigger 40 on the test data: "Ticket Closed: Email Notification sent to the Customer".
  const closed = {
    operator: 'AND',
    conditions: [
      { name: 'ticket.action', operator: 'is', value: 'update' },
      { name: 'ticket.state_id', operator: 'has changed', value: [] },
      { name: 'ticket.state_id', operator: 'is', value: ['4'] },
      { name: 'ticket.owner_id', operator: 'is not', pre_condition: 'not_set', value: [] },
      { name: 'ticket.tags', operator: 'contains one not', value: 'closed-notified, spam' },
    ],
  }

  it('turns expert-mode conditions into groups and back without changes', () => {
    const state = conditionToState(closed, triggerFields)

    expect(state.group?.children).toHaveLength(5)
    expect(stateRows(state).every((row) => row.raw === undefined)).toBe(true)
    expect(stateToCondition(state, triggerFields)).toEqual(closed)

    const nested = { operator: 'OR', conditions: [closed, { name: 'ticket.priority_id', operator: 'is', value: ['2'] }] }
    expect(stateToCondition(conditionToState(nested, triggerFields), triggerFields)).toEqual(nested)
  })

  it('saves the change that runs a trigger as one word, not a list', () => {
    const condition = {
      'ticket.action': { operator: 'is', value: 'create' },
      'article.action': { operator: 'is', value: 'create' },
      'article.internal': { operator: 'is', value: false },
      'customer.vip': { operator: 'is', value: true },
      'article.sender_id': { operator: 'is', value: ['2'] },
    }

    expect(rowsToCondition(conditionToRows(condition, triggerFields), triggerFields)).toEqual(condition)
  })

  it('offers "has changed" in triggers only, without a value to choose', () => {
    const owner = {
      'ticket.owner_id': { operator: 'has changed', pre_condition: 'current_user.id', value: [] },
    }
    const rows = conditionToRows(owner, triggerFields)

    expect(rows[0].raw).toBeUndefined()
    expect(conditionProblems(rows, triggerFields)).toEqual([])
    expect(rowsToCondition(rows, triggerFields)).toEqual(owner)

    expect(conditionToRows(owner, fields)[0].raw).toEqual(owner['ticket.owner_id'])
  })

  it('switches expert mode off only while the groups fit a plain list', () => {
    const repeated = conditionToState(closed, triggerFields).group!
    expect(groupToRows(repeated)).toBeNull()

    const rows = conditionToRows(condition, fields)
    expect(groupToRows(rowsToGroup(rows))).toEqual(rows)
    expect(groupToRows(newGroup('OR', rows))).toBeNull()

    const empty = { rows: [], group: newGroup('AND', [newGroup('OR')]) }
    expect(conditionStateProblems(empty, triggerFields)).toEqual(['Each group needs at least one condition.'])
  })

  it('sets a title and a customer', () => {
    const perform = {
      'ticket.title': { value: 'New starter' },
      'ticket.customer_id': { pre_condition: 'current_user.id', value: '', value_completion: '' },
    }
    expect(rowsToPerform(performToRows(perform, triggerActions), triggerActions)).toEqual(perform)

    const someone = {
      'ticket.customer_id': { pre_condition: 'specific', value: '12', value_completion: 'Ann Lee <ann@example.com>' },
    }
    expect(rowsToPerform(performToRows(someone, macroActions), macroActions)).toEqual(someone)

    const customer = emptyAction(triggerActions.find((field) => field.key === 'ticket.customer_id')!)
    expect(actionProblems([{ ...customer, preCondition: 'specific' }], triggerActions)).toEqual([
      'Set customer: choose a person.',
    ])
  })

  it('offers webhooks and deleting where they belong', () => {
    const keys = (list: { key: string }[]) => list.map((field) => field.key)

    expect(keys(actions)).toContain('ticket.action')
    expect(keys(triggerActions)).toContain('notification.webhook')
    expect(keys(triggerActions)).not.toContain('ticket.action')
    expect(keys(macroActions)).not.toContain('notification.webhook')
    expect(keys(macroActions)).toContain('ticket.customer_id')
  })
})
