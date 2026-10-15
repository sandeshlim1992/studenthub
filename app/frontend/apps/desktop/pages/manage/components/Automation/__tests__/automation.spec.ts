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
  fieldLabel,
  fromLocalInput,
  groupToRows,
  isExpertCondition,
  newGroup,
  performToRows,
  rowsToCondition,
  rowsToGroup,
  rowsToPerform,
  stateRows,
  stateToCondition,
  toLocalInput,
  type AutomationAttribute,
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

describe('the conditions and actions of the classic editor', () => {
  const attribute = (name: string, display: string, dataType: string, extra: Partial<AutomationAttribute> = {}) => ({
    name,
    display,
    data_type: dataType,
    active: true,
    options: [],
    ...extra,
  })

  const fullOptions: AutomationOptions = {
    ...options,
    organizations: [{ id: 5, name: 'LSST', active: true }],
    roles: [{ id: 3, name: 'Customer', active: true }],
    calendars: [{ id: 1, name: 'Office hours', active: true }],
    ticket_attributes: [
      ...options.ticket_attributes,
      attribute('itil_type', 'ITIL type', 'multi_tree_select', {
        options: [{ value: 'Service Requests', label: 'Service Requests' }],
      }),
    ],
    attributes: {
      ticket: [
        attribute('number', '#', 'input'),
        attribute('customer_id', 'Customer', 'user_autocompletion', { relation: 'User' }),
        attribute('state_id', 'State', 'select', { relation: 'TicketState' }),
        attribute('time_unit', 'Time units', 'integer'),
      ],
      user: [
        attribute('email', 'Email', 'input'),
        attribute('vip', 'VIP', 'boolean'),
        attribute('active', 'Active', 'active'),
        attribute('organization_id', 'Organization', 'autocompletion_ajax', { relation: 'Organization' }),
        attribute('note', 'Note', 'richtext'),
        attribute('birthday', 'Birthday', 'date'),
      ],
      organization: [attribute('name', 'Name', 'input'), attribute('shared', 'Shared organization', 'boolean')],
    },
  }

  const ticketFields = conditionFields(fullOptions)
  const keys = (list: { key: string }[]) => list.map((field) => field.key)
  const roundTrip = (condition: Record<string, unknown>, list = ticketFields) => {
    const rows = conditionToRows(condition, list)
    expect(rows.filter((row) => row.raw !== undefined)).toEqual([])
    return rowsToCondition(rows, list)
  }

  it('compares dates with a fixed date or today, and texts with several values', () => {
    const condition = {
      'ticket.created_at': { operator: 'before (absolute)', value: '2026-09-01T08:00:00.000Z' },
      'ticket.updated_at': { operator: 'today' },
      'ticket.title': { operator: 'starts with one of', value: ['Laptop', 'Password'] },
      'ticket.number': { operator: 'is any of', value: ['10012', '10013'] },
      'ticket.time_unit': { operator: 'is greater than', value: '30' },
    }

    expect(roundTrip(condition)).toEqual(condition)
    expect(conditionToRows(condition, ticketFields)[2].text).toBe('Laptop, Password')
  })

  it('offers the fields of the ticket, its customer and organization, and its messages', () => {
    expect(keys(ticketFields)).toEqual(
      expect.arrayContaining([
        'ticket.number',
        'ticket.customer_id',
        'ticket.created_by_id',
        'ticket.mention_user_ids',
        'article.subject',
        'article.body',
        'customer.email',
        'customer.organization_id',
        'organization.shared',
      ]),
    )
    expect(keys(ticketFields).filter((key) => key === 'ticket.state_id')).toHaveLength(1)
    expect(keys(ticketFields)).not.toContain('execution_time.calendar_id')

    const vip = ticketFields.find((field) => field.key === 'customer.vip')!
    expect(fieldLabel(vip)).toBe('Customer › VIP')

    const condition = {
      'customer.vip': { operator: 'is', value: true },
      'customer.organization_id': { operator: 'is', value: ['5'] },
      'organization.name': { operator: 'contains', value: 'LSST' },
      'customer.note': { operator: 'contains not', value: 'leaver' },
    }
    expect(roundTrip(condition)).toEqual(condition)
  })

  it('picks people by name, or nobody', () => {
    const condition = {
      'ticket.customer_id': { operator: 'is', pre_condition: 'specific', value: '12', value_completion: 'Ann Lee <ann@example.com>' },
      'ticket.created_by_id': { operator: 'is not', pre_condition: 'not_set', value: [] },
    }
    expect(roundTrip(condition)).toEqual(condition)

    const customer = emptyCondition(ticketFields.find((field) => field.key === 'ticket.customer_id')!)
    expect(conditionProblems([customer], ticketFields)).toEqual(['Customer: choose a person.'])
  })

  it('offers working hours in jobs and triggers, and "has reached" in triggers', () => {
    const scheduler = conditionFields(fullOptions, 'scheduler')
    const working = { 'execution_time.calendar_id': { operator: 'is not in working time', value: '1' } }
    expect(roundTrip(working, scheduler)).toEqual(working)

    const trigger = conditionFields(fullOptions, 'trigger')
    const timeEvent = {
      operator: 'AND',
      conditions: [
        { name: 'ticket.pending_time', operator: 'has reached', value: [] },
        { name: 'ticket.escalation_at', operator: 'has reached warning', value: [] },
        { name: 'article.time_accounting', operator: 'is set', value: [] },
        { name: 'ticket.number', operator: 'has changed', value: [] },
      ],
    }
    const state = conditionToState(timeEvent, trigger)
    expect(stateRows(state).every((row) => row.raw === undefined)).toBe(true)
    expect(conditionStateProblems(state, trigger)).toEqual([])
    expect(stateToCondition(state, trigger)).toEqual(timeEvent)

    expect(conditionToRows({ 'ticket.pending_time': { operator: 'has reached', value: [] } }, ticketFields)[0].raw).toBeDefined()
  })

  it('offers regular expressions in triggers only while Zammad allows them', () => {
    const regex = { 'ticket.title': { operator: 'matches regex', value: '^Laptop' } }

    expect(conditionToRows(regex, conditionFields(fullOptions, 'trigger'))[0].raw).toBeDefined()
    expect(roundTrip(regex, conditionFields(fullOptions, 'trigger', { allowRegex: true }))).toEqual(regex)
    expect(conditionToRows(regex, conditionFields(fullOptions, 'ticket', { allowRegex: true }))[0].raw).toBeDefined()
  })

  it('names what is missing in dates, numbers and lists', () => {
    const rows = conditionToRows(
      {
        'ticket.created_at': { operator: 'after (absolute)', value: '' },
        'ticket.time_unit': { operator: 'is', value: 'many' },
        'ticket.title': { operator: 'is any of', value: [] },
      },
      ticketFields,
    )

    expect(conditionProblems(rows, ticketFields)).toEqual([
      'Created at: enter a date.',
      'Time units: enter a number.',
      'Title: enter a value.',
    ])
  })

  it('offers jobs on users their own fields, their organization and their tickets', () => {
    const userFields = conditionFields(fullOptions, 'user')
    expect(keys(userFields)).toEqual(
      expect.arrayContaining([
        'user.role_ids',
        'user.last_login',
        'user.email',
        'user.vip',
        'organization.shared',
        'ticket_customer.open_existing',
        'ticket_customer.last_contact_at',
        'ticket_owner.existing',
      ]),
    )

    const condition = {
      'user.role_ids': { operator: 'is', value: ['3'] },
      'user.last_login': { operator: 'before (relative)', value: '1', range: 'year' },
      'user.birthday': { operator: 'after (absolute)', value: '2000-01-01' },
      'ticket_customer.open_existing': { operator: 'is', value: false },
    }
    expect(roundTrip(condition, userFields)).toEqual(condition)
    expect(userFields.find((field) => field.key === 'user.birthday')?.dateOnly).toBe(true)

    const organizationFields = conditionFields(fullOptions, 'organization')
    expect(keys(organizationFields)).toEqual(
      expect.arrayContaining(['organization.members_existing', 'organization.name', 'organization.shared']),
    )
  })

  it('switches users and organizations off, sets their fields and adds a privacy task', () => {
    const userActions = actionFields(fullOptions, 'user')
    expect(keys(userActions)).toEqual(['user.vip', 'user.active', 'user.organization_id', 'user.birthday', 'user.action'])

    const perform = {
      'user.active': { value: 'false' },
      'user.organization_id': { value: '5' },
      'user.action': { value: 'data_privacy_deletion_task' },
    }
    expect(rowsToPerform(performToRows(perform, userActions), userActions)).toEqual(perform)

    const privacy = emptyAction(userActions.find((field) => field.key === 'user.action')!)
    expect(rowsToPerform([privacy], userActions)).toEqual({ 'user.action': { value: 'data_privacy_deletion_task' } })
    expect(actionProblems([privacy], userActions)).toEqual([])

    expect(keys(actionFields(fullOptions, 'organization'))).toEqual(['organization.shared'])
  })

  it('fills in every field of a template, the message text included', () => {
    const templateActions = actionFields(fullOptions, 'template')
    expect(keys(templateActions)).not.toEqual(expect.arrayContaining(['article.note']))
    expect(keys(templateActions)).not.toContain('notification.webhook')

    // A template from the test server.
    const template = {
      'article.body': { value: '<div><p>Dear IT Support,</p></div>' },
      'ticket.title': { value: 'Password Reset Request' },
      'ticket.campus': { value: 'LSST' },
      'ticket.itil_type': { value: ['Service Requests'], value_completion: '' },
      'ticket.priority_id': { value: '2' },
      'ticket.formSenderType': { value: 'phone-in' },
      'article.cc': { value: 'it@example.com' },
      'ticket.pending_time': { operator: 'relative', value: '3', range: 'day' },
    }
    const rows = performToRows(template, templateActions)

    expect(rows.filter((row) => row.raw !== undefined)).toEqual([])
    expect(rowsToPerform(rows, templateActions)).toEqual(template)

    const fixed = { 'ticket.pending_time': { operator: 'static', value: '2026-11-02T09:30:00.000Z' } }
    expect(rowsToPerform(performToRows(fixed, templateActions), templateActions)).toEqual(fixed)
  })

  it('names what is missing in the new actions', () => {
    const templateActions = actionFields(fullOptions, 'template')
    const empty = (key: string) => emptyAction(templateActions.find((field) => field.key === key)!)

    expect(
      actionProblems(
        [empty('ticket.itil_type'), { ...empty('ticket.pending_time'), operator: 'static', value: '' }, empty('article.body')],
        templateActions,
      ),
    ).toEqual(['Set ITIL type: choose at least one.', 'Set pending till: enter a date.', 'Message text: enter a text.'])
  })

  it('shows a fixed time in the browser time zone and keeps it in UTC', () => {
    expect(toLocalInput('2026-09-01T08:00:00.000Z')).toBe('2026-09-01T08:00')
    expect(fromLocalInput('2026-09-01T08:00')).toBe('2026-09-01T08:00:00.000Z')
    expect(toLocalInput('')).toBe('')
    expect(fromLocalInput('')).toBe('')
  })
})
