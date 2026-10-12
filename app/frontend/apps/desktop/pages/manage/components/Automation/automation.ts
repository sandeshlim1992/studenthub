// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: ticket conditions and actions of automations (Scheduler, Triggers, Macros, SLAs,
// Report Profiles, Time Accounting), as rows for the editors of the new UI, and back into Zammad's
// format:
//   condition: { 'ticket.state_id': { operator: 'is', value: ['2'] },
//                'ticket.updated_at': { operator: 'before (relative)', value: '5', range: 'day' } }
//   expert mode: { operator: 'AND', conditions: [{ name: 'ticket.state_id', operator: 'is', … }, { operator: 'OR', conditions: […] }] }
//   perform:   { 'ticket.state_id': { value: '4' }, 'ticket.tags': { operator: 'add', value: 'a, b' },
//                'notification.email': { recipient: ['ticket_customer'], subject: '…', body: '…' } }
// Anything the editors don't know is kept as it is ("kept" rows), so saving never loses it.

export interface AutomationRecord {
  id: number
  name: string
  active: boolean
}

export interface AutomationAttribute {
  name: string
  display: string
  data_type: string
  active: boolean
  options: { value: string; label: string }[]
}

export interface AutomationOptions {
  states: AutomationRecord[]
  priorities: AutomationRecord[]
  groups: AutomationRecord[]
  agents: AutomationRecord[]
  organizations: AutomationRecord[]
  webhooks: AutomationRecord[]
  article_senders?: AutomationRecord[]
  article_types?: AutomationRecord[]
  ticket_attributes: AutomationAttribute[]
}

export interface ChoiceOption {
  value: string
  label: string
}

// What the fields are offered for: ticket conditions (Scheduler, SLAs, Report Profiles, Time
// Accounting) or a trigger's, which also know the change that runs it and its message.
export type ConditionFlavour = 'ticket' | 'trigger'

// What the actions are offered for.
export type ActionFlavour = 'scheduler' | 'trigger' | 'macro'

// single: one value, saved as it is and not as a list (Action, yes/no fields).
export type FieldKind = 'choice' | 'owner' | 'tags' | 'text' | 'date' | 'single'

export interface ConditionField {
  key: string
  label: string
  kind: FieldKind
  choices?: ChoiceOption[]
  // The operators offered, when not the kind's usual ones.
  operators?: ChoiceOption[]
  // owner: who can be chosen besides specific agents.
  preConditions?: ChoiceOption[]
  // single: 'boolean' for yes/no fields, saved as true / false.
  valueType?: 'string' | 'boolean'
}

export type RelativeRange = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface ConditionRow {
  uid: number
  key: string
  operator: string
  values: string[]
  text: string
  amount: string
  range: RelativeRange
  // owner: 'specific', 'not_set' or (triggers) 'current_user.id'
  preCondition: string
  // a condition the editor doesn't know, kept as it is
  raw?: unknown
}

// Expert mode: conditions in groups that all, any or none must match, groups inside groups.
export type GroupOperator = 'AND' | 'OR' | 'NOT'

export interface ConditionGroup {
  uid: number
  operator: GroupOperator
  children: ConditionNode[]
}

export type ConditionNode = ConditionGroup | ConditionRow

// The conditions of a record: a plain list, or (expert mode) a group.
export interface ConditionState {
  rows: ConditionRow[]
  group: ConditionGroup | null
}

export type ActionKind =
  | 'choice'
  | 'owner'
  | 'tags'
  | 'note'
  | 'email'
  | 'webhook'
  | 'delete'
  | 'text'
  | 'customer'

export interface ActionField {
  key: string
  label: string
  kind: ActionKind
  choices?: ChoiceOption[]
}

export interface ActionRow {
  uid: number
  key: string
  value: string
  operator: string
  subject: string
  body: string
  internal: boolean
  recipients: string[]
  // customer: 'specific' or 'current_user.id'; completion is the chosen person's name
  preCondition: string
  completion: string
  // email settings this editor doesn't show (e.g. include_attachments), kept as they are
  extra?: Record<string, unknown>
  raw?: unknown
}

let nextUid = 1
export const newUid = () => nextUid++

const recordChoices = (records: AutomationRecord[]) =>
  records.map((record) => ({
    value: String(record.id),
    label: record.active ? record.name : i18n.t('%s (inactive)', record.name),
  }))

// Ticket dates that conditions can compare with "now".
const DATE_FIELDS: [string, string][] = [
  ['ticket.created_at', __('Created at')],
  ['ticket.updated_at', __('Updated at')],
  ['ticket.pending_time', __('Pending till')],
  ['ticket.last_contact_at', __('Last contact')],
  ['ticket.last_contact_agent_at', __('Last contact (agent)')],
  ['ticket.last_contact_customer_at', __('Last contact (customer)')],
  ['ticket.first_response_escalation_at', __('Escalation at (first response)')],
  ['ticket.update_escalation_at', __('Escalation at (update)')],
  ['ticket.close_escalation_at', __('Escalation at (resolution)')],
  ['ticket.escalation_at', __('Escalation at')],
]

export const HAS_CHANGED = 'has changed'

const HAS_CHANGED_OPERATOR: ChoiceOption = { value: HAS_CHANGED, label: __('has changed') }

export const RELATIVE_OPERATORS: ChoiceOption[] = [
  { value: 'before (relative)', label: __('more than … ago') },
  { value: 'within last (relative)', label: __('within the last …') },
  { value: 'within next (relative)', label: __('within the next …') },
  { value: 'after (relative)', label: __('more than … from now') },
  { value: 'till (relative)', label: __('before … from now') },
  { value: 'from (relative)', label: __('after … ago') },
]

export const RELATIVE_RANGES: ChoiceOption[] = [
  { value: 'minute', label: __('minute(s)') },
  { value: 'hour', label: __('hour(s)') },
  { value: 'day', label: __('day(s)') },
  { value: 'week', label: __('week(s)') },
  { value: 'month', label: __('month(s)') },
  { value: 'year', label: __('year(s)') },
]

export const CHOICE_OPERATORS: ChoiceOption[] = [
  { value: 'is', label: __('is') },
  { value: 'is not', label: __('is not') },
]

export const TAG_OPERATORS: ChoiceOption[] = [
  { value: 'contains all', label: __('has all of') },
  { value: 'contains one', label: __('has one of') },
  { value: 'contains all not', label: __('has none of all') },
  { value: 'contains one not', label: __('has none of') },
]

export const TEXT_OPERATORS: ChoiceOption[] = [
  { value: 'contains', label: __('contains') },
  { value: 'contains not', label: __('does not contain') },
  { value: 'is', label: __('is') },
  { value: 'is not', label: __('is not') },
]

export const GROUP_OPERATORS: ChoiceOption[] = [
  { value: 'AND', label: __('all of these') },
  { value: 'OR', label: __('any of these') },
  { value: 'NOT', label: __('none of these') },
]

export const EMAIL_RECIPIENTS: ChoiceOption[] = [
  { value: 'ticket_customer', label: __('Customer') },
  { value: 'ticket_owner', label: __('Owner') },
  { value: 'ticket_agents', label: __('All agents of the team') },
  { value: 'article_last_sender', label: __('Sender of the last message') },
]

const OWNER_CHOICES: ChoiceOption[] = [
  { value: 'not_set', label: __('nobody (unassigned)') },
  { value: 'specific', label: __('one of these agents') },
]

// In a trigger, the current user is whoever made the change that runs it.
const CURRENT_USER: ChoiceOption = { value: 'current_user.id', label: __('the current user') }

// The change that runs a trigger (ticket.action), compared by Zammad as one word.
const TICKET_ACTIONS: ChoiceOption[] = [
  { value: 'create', label: __('created') },
  { value: 'update', label: __('updated') },
  { value: 'update.merged_into', label: __('merged into') },
  { value: 'update.received_merge', label: __('received merge') },
]

const YES_NO: ChoiceOption[] = [
  { value: 'true', label: __('yes') },
  { value: 'false', label: __('no') },
]

const selectAttributeChoices = (attribute: AutomationAttribute) =>
  attribute.data_type === 'boolean' ? YES_NO : attribute.options

const withHasChanged = (operators: ChoiceOption[]) => [...operators, HAS_CHANGED_OPERATOR]

export const operatorsOf = (field?: ConditionField): ChoiceOption[] => {
  if (field?.operators) return field.operators

  switch (field?.kind) {
    case 'date':
      return RELATIVE_OPERATORS
    case 'tags':
      return TAG_OPERATORS
    case 'text':
      return TEXT_OPERATORS
    default:
      return CHOICE_OPERATORS
  }
}

export const conditionFields = (
  options: AutomationOptions,
  flavour: ConditionFlavour = 'ticket',
): ConditionField[] => {
  const trigger = flavour === 'trigger'
  // A trigger also asks whether a field has just changed.
  const changeable = (operators: ChoiceOption[]) => (trigger ? withHasChanged(operators) : undefined)

  return [
    ...(trigger
      ? [
          {
            key: 'ticket.action',
            label: __('Action'),
            kind: 'single' as const,
            choices: TICKET_ACTIONS,
            operators: CHOICE_OPERATORS,
            valueType: 'string' as const,
          },
        ]
      : []),
    { key: 'ticket.state_id', label: __('State'), kind: 'choice', choices: recordChoices(options.states), operators: changeable(CHOICE_OPERATORS) },
    { key: 'ticket.priority_id', label: __('Priority'), kind: 'choice', choices: recordChoices(options.priorities), operators: changeable(CHOICE_OPERATORS) },
    { key: 'ticket.group_id', label: __('Team'), kind: 'choice', choices: recordChoices(options.groups), operators: changeable(CHOICE_OPERATORS) },
    {
      key: 'ticket.owner_id',
      label: __('Owner'),
      kind: 'owner',
      choices: recordChoices(options.agents),
      operators: changeable(CHOICE_OPERATORS),
      preConditions: trigger ? [...OWNER_CHOICES, CURRENT_USER] : OWNER_CHOICES,
    },
    {
      key: 'ticket.organization_id',
      label: __('Organization'),
      kind: 'choice',
      choices: recordChoices(options.organizations),
      operators: changeable(CHOICE_OPERATORS),
    },
    ...options.ticket_attributes.map<ConditionField>((attribute) => ({
      key: `ticket.${attribute.name}`,
      label: attribute.active ? attribute.display : i18n.t('%s (inactive)', attribute.display),
      kind: 'choice',
      choices: selectAttributeChoices(attribute),
      operators: changeable(CHOICE_OPERATORS),
    })),
    { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
    { key: 'ticket.title', label: __('Title'), kind: 'text', operators: changeable(TEXT_OPERATORS) },
    ...DATE_FIELDS.map<ConditionField>(([key, label]) => ({
      key,
      label,
      kind: 'date',
      operators: changeable(RELATIVE_OPERATORS),
    })),
    ...(trigger
      ? [
          {
            key: 'article.action',
            label: __('Message'),
            kind: 'single' as const,
            choices: [{ value: 'create', label: __('created') }],
            operators: CHOICE_OPERATORS,
            valueType: 'string' as const,
          },
          {
            key: 'article.sender_id',
            label: __('Message sender'),
            kind: 'choice' as const,
            choices: recordChoices(options.article_senders ?? []),
            operators: withHasChanged(CHOICE_OPERATORS),
          },
          {
            key: 'article.type_id',
            label: __('Message type'),
            kind: 'choice' as const,
            choices: recordChoices(options.article_types ?? []),
            operators: withHasChanged(CHOICE_OPERATORS),
          },
          {
            key: 'article.internal',
            label: __('Internal message'),
            kind: 'single' as const,
            choices: YES_NO,
            operators: withHasChanged(CHOICE_OPERATORS),
            valueType: 'boolean' as const,
          },
          {
            key: 'customer.vip',
            label: __('Customer is VIP'),
            kind: 'single' as const,
            choices: YES_NO,
            operators: withHasChanged(CHOICE_OPERATORS),
            valueType: 'boolean' as const,
          },
        ]
      : []),
  ]
}

export const actionFields = (
  options: AutomationOptions,
  flavour: ActionFlavour = 'scheduler',
): ActionField[] => [
  { key: 'ticket.state_id', label: __('Set state'), kind: 'choice', choices: recordChoices(options.states) },
  { key: 'ticket.priority_id', label: __('Set priority'), kind: 'choice', choices: recordChoices(options.priorities) },
  { key: 'ticket.group_id', label: __('Move to team'), kind: 'choice', choices: recordChoices(options.groups) },
  { key: 'ticket.owner_id', label: __('Set owner'), kind: 'owner', choices: recordChoices(options.agents) },
  ...options.ticket_attributes
    .filter((attribute) => attribute.active)
    .map<ActionField>((attribute) => ({
      key: `ticket.${attribute.name}`,
      label: i18n.t('Set %s', attribute.display),
      kind: 'choice',
      choices: selectAttributeChoices(attribute),
    })),
  { key: 'ticket.title', label: __('Set title'), kind: 'text' },
  ...(flavour === 'scheduler' ? [] : [{ key: 'ticket.customer_id', label: __('Set customer'), kind: 'customer' as const }]),
  { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
  { key: 'article.note', label: __('Add an internal note'), kind: 'note' },
  { key: 'notification.email', label: __('Send an email'), kind: 'email' },
  ...(flavour === 'macro'
    ? []
    : [
        {
          key: 'notification.webhook',
          label: __('Call a webhook'),
          kind: 'webhook' as const,
          choices: recordChoices(options.webhooks),
        },
      ]),
  ...(flavour === 'scheduler' ? [{ key: 'ticket.action', label: __('Delete the ticket'), kind: 'delete' as const }] : []),
]

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const asStrings = (value: unknown) =>
  (Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value]).map(String)

export const emptyCondition = (field: ConditionField): ConditionRow => ({
  uid: newUid(),
  key: field.key,
  operator:
    field.kind === 'date'
      ? 'before (relative)'
      : field.kind === 'tags'
        ? 'contains one'
        : field.kind === 'text'
          ? 'contains'
          : 'is',
  values: [],
  text: '',
  amount: '1',
  range: 'day',
  preCondition: 'specific',
})

export const emptyAction = (field: ActionField): ActionRow => ({
  uid: newUid(),
  key: field.key,
  value: field.kind === 'delete' ? 'delete' : '',
  operator: 'add',
  subject: '',
  body: '',
  internal: true,
  recipients: field.kind === 'email' ? ['ticket_customer'] : [],
  preCondition: field.kind === 'customer' ? 'current_user.id' : 'specific',
  completion: '',
})

// Zammad's "expert mode" conditions ({ operator: 'AND', conditions: [...] }).
export const isExpertCondition = (condition: unknown) =>
  Boolean(asRecord(condition)?.conditions && asRecord(condition)?.operator)

// One condition, from Zammad's format. Unknown fields and operators are kept as they are.
export const settingToRow = (key: string, setting: unknown, fields: ConditionField[]): ConditionRow => {
  const field = fields.find((item) => item.key === key)
  const data = asRecord(setting)
  const operator = String(data?.operator ?? '')
  const base = { uid: newUid(), key, operator, values: [], text: '', amount: '1', range: 'day' as RelativeRange, preCondition: 'specific' }

  if (!field || !data || !operatorsOf(field).some((item) => item.value === operator)) return { ...base, raw: setting }

  if (field.kind === 'owner') {
    const preCondition = String(data.pre_condition ?? 'specific')
    if (preCondition !== 'specific' && !(field.preConditions ?? OWNER_CHOICES).some((item) => item.value === preCondition)) {
      return { ...base, raw: setting }
    }
    if (operator === HAS_CHANGED) return { ...base, preCondition }
    return { ...base, preCondition, values: asStrings(data.value) }
  }

  if (operator === HAS_CHANGED) return base

  switch (field.kind) {
    case 'date':
      return { ...base, amount: String(data.value ?? '1'), range: String(data.range ?? 'day') as RelativeRange }
    case 'tags':
      return { ...base, text: asStrings(data.value).join(', ') }
    case 'text':
      return { ...base, text: String(data.value ?? '') }
    case 'single':
      return { ...base, values: asStrings(Array.isArray(data.value) ? data.value[0] : data.value) }
    default:
      return { ...base, values: asStrings(data.value) }
  }
}

// One condition, in Zammad's format.
export const rowToSetting = (row: ConditionRow, fields: ConditionField[]): unknown => {
  if (row.raw !== undefined) return row.raw

  const field = fields.find((item) => item.key === row.key)

  if (row.operator === HAS_CHANGED) {
    return field?.kind === 'owner'
      ? { operator: row.operator, pre_condition: row.preCondition, value: [] }
      : { operator: row.operator, value: [] }
  }

  switch (field?.kind) {
    case 'date':
      return { operator: row.operator, value: String(row.amount), range: row.range }
    case 'tags':
    case 'text':
      return { operator: row.operator, value: row.text.trim() }
    case 'owner':
      return row.preCondition === 'specific'
        ? { operator: row.operator, pre_condition: 'specific', value: row.values }
        : { operator: row.operator, pre_condition: row.preCondition, value: [] }
    case 'single': {
      const value = row.values[0] ?? ''
      return { operator: row.operator, value: field.valueType === 'boolean' ? value === 'true' : value }
    }
    default:
      return { operator: row.operator, value: row.values }
  }
}

export const conditionToRows = (condition: unknown, fields: ConditionField[]): ConditionRow[] =>
  Object.entries(asRecord(condition) ?? {}).map(([key, setting]) => settingToRow(key, setting, fields))

export const rowsToCondition = (rows: ConditionRow[], fields: ConditionField[]) =>
  Object.fromEntries(rows.map((row) => [row.key, rowToSetting(row, fields)]))

export const isGroup = (node: ConditionNode): node is ConditionGroup => 'children' in node

export const newGroup = (operator: GroupOperator = 'AND', children: ConditionNode[] = []): ConditionGroup => ({
  uid: newUid(),
  operator,
  children,
})

export const expertToGroup = (condition: unknown, fields: ConditionField[]): ConditionGroup => {
  const data = asRecord(condition)
  const operator = String(data?.operator ?? 'AND').toUpperCase()

  return newGroup(
    GROUP_OPERATORS.some((item) => item.value === operator) ? (operator as GroupOperator) : 'AND',
    (Array.isArray(data?.conditions) ? data.conditions : []).map((item: unknown) => {
      const entry = asRecord(item)
      if (entry && Array.isArray(entry.conditions)) return expertToGroup(entry, fields)

      const { name, ...setting } = entry ?? {}
      return settingToRow(String(name ?? ''), entry ? setting : item, fields)
    }),
  )
}

export const groupToExpert = (group: ConditionGroup, fields: ConditionField[]): Record<string, unknown> => ({
  operator: group.operator,
  conditions: group.children.map((child) =>
    isGroup(child) ? groupToExpert(child, fields) : { name: child.key, ...asRecord(rowToSetting(child, fields)) },
  ),
})

const groupRows = (group: ConditionGroup): ConditionRow[] =>
  group.children.flatMap((child) => (isGroup(child) ? groupRows(child) : [child]))

const groups = (group: ConditionGroup): ConditionGroup[] => [
  group,
  ...group.children.filter(isGroup).flatMap((child) => groups(child)),
]

// Expert mode on: the list becomes one "all of these" group.
export const rowsToGroup = (rows: ConditionRow[]) => newGroup('AND', [...rows])

// Expert mode off: only while it is one "all of these" group without groups or repeated fields.
export const groupToRows = (group: ConditionGroup): ConditionRow[] | null => {
  if (group.operator !== 'AND' || group.children.some(isGroup)) return null

  const rows = group.children as ConditionRow[]
  return new Set(rows.map((row) => row.key)).size === rows.length ? rows : null
}

export const emptyConditionState = (): ConditionState => ({ rows: [], group: null })

export const conditionToState = (condition: unknown, fields: ConditionField[]): ConditionState =>
  isExpertCondition(condition)
    ? { rows: [], group: expertToGroup(condition, fields) }
    : { rows: conditionToRows(condition, fields), group: null }

export const stateToCondition = (state: ConditionState, fields: ConditionField[]) =>
  state.group ? groupToExpert(state.group, fields) : rowsToCondition(state.rows, fields)

export const stateRows = (state: ConditionState) => (state.group ? groupRows(state.group) : state.rows)

export const performToRows = (perform: unknown, fields: ActionField[]): ActionRow[] =>
  Object.entries(asRecord(perform) ?? {}).map(([key, setting]) => {
    const field = fields.find((item) => item.key === key)
    const data = asRecord(setting)
    const base: ActionRow = {
      uid: newUid(),
      key,
      value: '',
      operator: 'add',
      subject: '',
      body: '',
      internal: true,
      recipients: [],
      preCondition: 'specific',
      completion: '',
    }

    if (!field || !data) return { ...base, raw: setting }

    switch (field.kind) {
      case 'tags':
        return { ...base, operator: String(data.operator ?? 'add'), value: String(data.value ?? '') }
      case 'note':
        return {
          ...base,
          subject: String(data.subject ?? ''),
          body: String(data.body ?? ''),
          internal: String(data.internal ?? 'true') === 'true',
        }
      case 'email': {
        // Keep settings this editor doesn't show (e.g. include_attachments, sender).
        const { recipient, subject, body, ...rest } = data
        return {
          ...base,
          recipients: asStrings(recipient),
          subject: String(subject ?? ''),
          body: String(body ?? ''),
          extra: rest,
        }
      }
      case 'webhook':
        return { ...base, value: String(data.webhook_id ?? '') }
      case 'owner':
        if (data.pre_condition && data.pre_condition !== 'specific') return { ...base, raw: setting }
        return { ...base, value: String(data.value ?? '') }
      case 'customer': {
        const preCondition = String(data.pre_condition ?? 'specific')
        if (preCondition !== 'specific' && preCondition !== 'current_user.id') return { ...base, raw: setting }
        return {
          ...base,
          preCondition,
          value: String(data.value ?? ''),
          completion: String(data.value_completion ?? ''),
        }
      }
      case 'delete':
        return { ...base, value: String(data.value ?? 'delete') }
      default:
        return { ...base, value: String(data.value ?? '') }
    }
  })

export const rowsToPerform = (rows: ActionRow[], fields: ActionField[]) =>
  Object.fromEntries(
    rows.map((row) => {
      if (row.raw !== undefined) return [row.key, row.raw]

      const kind = fields.find((item) => item.key === row.key)?.kind

      switch (kind) {
        case 'tags':
          return [row.key, { operator: row.operator, value: row.value.trim() }]
        case 'note':
          return [row.key, { subject: row.subject, body: row.body, internal: String(row.internal) }]
        case 'email':
          return [row.key, { ...row.extra, recipient: row.recipients, subject: row.subject, body: row.body }]
        case 'webhook':
          return [row.key, { webhook_id: row.value }]
        case 'owner':
          return [row.key, { pre_condition: 'specific', value: row.value, value_completion: '' }]
        case 'customer':
          return [
            row.key,
            row.preCondition === 'specific'
              ? { pre_condition: 'specific', value: row.value, value_completion: row.completion }
              : { pre_condition: row.preCondition, value: '', value_completion: '' },
          ]
        default:
          return [row.key, { value: row.value }]
      }
    }),
  )

// What must be filled in before Zammad accepts the record (Validations::VerifyPerformRulesValidator).
export const conditionProblems = (rows: ConditionRow[], fields: ConditionField[]) =>
  rows
    .filter((row) => row.raw === undefined && row.operator !== HAS_CHANGED)
    .flatMap((row) => {
      const field = fields.find((item) => item.key === row.key)
      if (!field) return []
      const label = i18n.t(field.label)

      switch (field.kind) {
        case 'date':
          return Number(row.amount) > 0 ? [] : [i18n.t('%s: enter a number above 0.', label)]
        case 'tags':
        case 'text':
          return row.text.trim() ? [] : [i18n.t('%s: enter a value.', label)]
        case 'owner':
          return row.preCondition !== 'specific' || row.values.length ? [] : [i18n.t('%s: choose at least one.', label)]
        default:
          return row.values.length ? [] : [i18n.t('%s: choose at least one.', label)]
      }
    })

export const conditionStateProblems = (state: ConditionState, fields: ConditionField[]) => [
  ...conditionProblems(stateRows(state), fields),
  ...(state.group && groups(state.group).some((group) => group.children.length === 0)
    ? [i18n.t('Each group needs at least one condition.')]
    : []),
]

export const actionProblems = (rows: ActionRow[], fields: ActionField[]) =>
  rows.flatMap((row) => {
    const field = fields.find((item) => item.key === row.key)
    if (!field || row.raw !== undefined) return []
    const label = i18n.t(field.label)

    switch (field.kind) {
      case 'note':
        return row.subject.trim() && row.body.trim() ? [] : [i18n.t('%s: enter a subject and a text.', label)]
      case 'email':
        return row.recipients.length && row.subject.trim() && row.body.trim()
          ? []
          : [i18n.t('%s: choose recipients and enter a subject and a text.', label)]
      case 'tags':
        return row.value.trim() ? [] : [i18n.t('%s: enter at least one tag.', label)]
      case 'text':
        return row.value.trim() ? [] : [i18n.t('%s: enter a value.', label)]
      case 'customer':
        return row.preCondition !== 'specific' || row.value ? [] : [i18n.t('%s: choose a person.', label)]
      case 'delete':
        return []
      default:
        return row.value ? [] : [i18n.t('%s: choose a value.', label)]
    }
  })
