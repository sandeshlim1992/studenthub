// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: ticket conditions and actions of automations (Scheduler), as rows for the editors of
// the new UI, and back into Zammad's format:
//   condition: { 'ticket.state_id': { operator: 'is', value: ['2'] },
//                'ticket.updated_at': { operator: 'before (relative)', value: '5', range: 'day' } }
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
  ticket_attributes: AutomationAttribute[]
}

export interface ChoiceOption {
  value: string
  label: string
}

export type FieldKind = 'choice' | 'owner' | 'tags' | 'text' | 'date'

export interface ConditionField {
  key: string
  label: string
  kind: FieldKind
  choices?: ChoiceOption[]
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
  // owner / organization: 'specific' or 'not_set'
  preCondition: string
  // a condition the editor doesn't know, kept as it is
  raw?: unknown
}

export type ActionKind = 'choice' | 'owner' | 'tags' | 'note' | 'email' | 'webhook' | 'delete'

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

export const EMAIL_RECIPIENTS: ChoiceOption[] = [
  { value: 'ticket_customer', label: __('Customer') },
  { value: 'ticket_owner', label: __('Owner') },
  { value: 'ticket_agents', label: __('All agents of the team') },
  { value: 'article_last_sender', label: __('Sender of the last message') },
]

const selectAttributeChoices = (attribute: AutomationAttribute) =>
  attribute.data_type === 'boolean'
    ? [
        { value: 'true', label: __('yes') },
        { value: 'false', label: __('no') },
      ]
    : attribute.options

export const conditionFields = (options: AutomationOptions): ConditionField[] => [
  { key: 'ticket.state_id', label: __('State'), kind: 'choice', choices: recordChoices(options.states) },
  { key: 'ticket.priority_id', label: __('Priority'), kind: 'choice', choices: recordChoices(options.priorities) },
  { key: 'ticket.group_id', label: __('Team'), kind: 'choice', choices: recordChoices(options.groups) },
  { key: 'ticket.owner_id', label: __('Owner'), kind: 'owner', choices: recordChoices(options.agents) },
  {
    key: 'ticket.organization_id',
    label: __('Organization'),
    kind: 'choice',
    choices: recordChoices(options.organizations),
  },
  ...options.ticket_attributes.map<ConditionField>((attribute) => ({
    key: `ticket.${attribute.name}`,
    label: attribute.active ? attribute.display : i18n.t('%s (inactive)', attribute.display),
    kind: 'choice',
    choices: selectAttributeChoices(attribute),
  })),
  { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
  { key: 'ticket.title', label: __('Title'), kind: 'text' },
  ...DATE_FIELDS.map<ConditionField>(([key, label]) => ({ key, label, kind: 'date' })),
]

export const actionFields = (options: AutomationOptions): ActionField[] => [
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
  { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
  { key: 'article.note', label: __('Add an internal note'), kind: 'note' },
  { key: 'notification.email', label: __('Send an email'), kind: 'email' },
  {
    key: 'notification.webhook',
    label: __('Call a webhook'),
    kind: 'webhook',
    choices: recordChoices(options.webhooks),
  },
  { key: 'ticket.action', label: __('Delete the ticket'), kind: 'delete' },
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
})

// Zammad's "expert mode" conditions ({ operator: 'AND', conditions: [...] }) aren't edited here.
export const isExpertCondition = (condition: unknown) =>
  Boolean(asRecord(condition)?.conditions && asRecord(condition)?.operator)

export const conditionToRows = (condition: unknown, fields: ConditionField[]): ConditionRow[] =>
  Object.entries(asRecord(condition) ?? {}).map(([key, setting]) => {
    const field = fields.find((item) => item.key === key)
    const data = asRecord(setting)
    const operator = String(data?.operator ?? '')
    const base = { uid: newUid(), key, operator, values: [], text: '', amount: '1', range: 'day' as RelativeRange, preCondition: 'specific' }

    if (!field || !data) return { ...base, raw: setting }

    switch (field.kind) {
      case 'date':
        if (!RELATIVE_OPERATORS.some((item) => item.value === operator)) return { ...base, raw: setting }
        return { ...base, amount: String(data.value ?? '1'), range: String(data.range ?? 'day') as RelativeRange }
      case 'tags':
        return { ...base, text: asStrings(data.value).join(', ') }
      case 'text':
        return { ...base, text: String(data.value ?? '') }
      case 'owner':
        return {
          ...base,
          preCondition: String(data.pre_condition ?? 'specific'),
          values: asStrings(data.value),
        }
      default:
        return { ...base, values: asStrings(data.value) }
    }
  })

export const rowsToCondition = (rows: ConditionRow[], fields: ConditionField[]) =>
  Object.fromEntries(
    rows.map((row) => {
      if (row.raw !== undefined) return [row.key, row.raw]

      const kind = fields.find((item) => item.key === row.key)?.kind
      switch (kind) {
        case 'date':
          return [row.key, { operator: row.operator, value: String(row.amount), range: row.range }]
        case 'tags':
        case 'text':
          return [row.key, { operator: row.operator, value: row.text.trim() }]
        case 'owner':
          return [
            row.key,
            row.preCondition === 'specific'
              ? { operator: row.operator, pre_condition: 'specific', value: row.values }
              : { operator: row.operator, pre_condition: row.preCondition, value: [] },
          ]
        default:
          return [row.key, { operator: row.operator, value: row.values }]
      }
    }),
  )

export const performToRows = (perform: unknown, fields: ActionField[]): ActionRow[] =>
  Object.entries(asRecord(perform) ?? {}).map(([key, setting]) => {
    const field = fields.find((item) => item.key === key)
    const data = asRecord(setting)
    const base: ActionRow = { uid: newUid(), key, value: '', operator: 'add', subject: '', body: '', internal: true, recipients: [] }

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
        default:
          return [row.key, { value: row.value }]
      }
    }),
  )

// What must be filled in before Zammad accepts the job (Validations::VerifyPerformRulesValidator).
export const conditionProblems = (rows: ConditionRow[], fields: ConditionField[]) =>
  rows
    .filter((row) => row.raw === undefined)
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
      case 'delete':
        return []
      default:
        return row.value ? [] : [i18n.t('%s: choose a value.', label)]
    }
  })
