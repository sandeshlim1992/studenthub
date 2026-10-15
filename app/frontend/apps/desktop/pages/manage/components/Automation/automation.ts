// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: conditions and actions of automations (Scheduler, Triggers, Macros, Templates, SLAs,
// Report Profiles, Time Accounting), as rows for the editors of the new UI, and back into Zammad's
// format:
//   condition: { 'ticket.state_id': { operator: 'is', value: ['2'] },
//                'ticket.updated_at': { operator: 'before (relative)', value: '5', range: 'day' } }
//   expert mode: { operator: 'AND', conditions: [{ name: 'ticket.state_id', operator: 'is', … }, { operator: 'OR', conditions: […] }] }
//   perform:   { 'ticket.state_id': { value: '4' }, 'ticket.tags': { operator: 'add', value: 'a, b' },
//                'notification.email': { recipient: ['ticket_customer'], subject: '…', body: '…' } }
// Scheduler jobs can also work on users and organizations ('user.active', 'organization.shared', …).
// Besides the fields listed here, the fields of tickets, customers and organizations come from
// Zammad's object manager (options.attributes), so fields added there are offered too. Anything the
// editors don't know is kept as it is ("kept" rows), so saving never loses it.

export interface AutomationRecord {
  id: number
  name: string
  active: boolean
}

export interface ChoiceOption {
  value: string
  label: string
}

export interface AutomationAttribute {
  name: string
  display: string
  data_type: string
  active: boolean
  // The kind of record the field points to (User, Organization, …), if any.
  relation?: string | null
  options: ChoiceOption[]
}

export type AttributeObject = 'ticket' | 'user' | 'organization'

export interface AutomationOptions {
  states: AutomationRecord[]
  priorities: AutomationRecord[]
  groups: AutomationRecord[]
  agents: AutomationRecord[]
  organizations: AutomationRecord[]
  webhooks: AutomationRecord[]
  article_senders?: AutomationRecord[]
  article_types?: AutomationRecord[]
  roles?: AutomationRecord[]
  calendars?: AutomationRecord[]
  ticket_attributes: AutomationAttribute[]
  attributes?: Partial<Record<AttributeObject, AutomationAttribute[]>>
}

// What the fields are offered for: ticket conditions (SLAs, Report Profiles, Time Accounting), a
// scheduler job's on tickets (which also knows the working hours it runs in), a trigger's (which
// also knows the change that runs it and its message), or a scheduler job's on users or organizations.
export type ConditionFlavour = 'ticket' | 'scheduler' | 'trigger' | 'user' | 'organization'

// What the actions are offered for.
export type ActionFlavour = 'scheduler' | 'trigger' | 'macro' | 'template' | 'user' | 'organization'

// single: one value, saved as it is and not as a list (Action, yes/no fields, calendar).
// person: someone found by name or email, nobody, or (triggers) whoever made the change.
export type FieldKind = 'choice' | 'owner' | 'person' | 'tags' | 'text' | 'number' | 'date' | 'single'

export interface ConditionField {
  key: string
  label: string
  kind: FieldKind
  // Whose field it is ("Customer"), shown before the label and as a heading in the list of fields.
  group?: string
  choices?: ChoiceOption[]
  // The operators offered, when not the kind's usual ones.
  operators?: ChoiceOption[]
  // owner and person: who can be chosen besides specific people.
  preConditions?: ChoiceOption[]
  // single: 'boolean' for yes/no fields, saved as true / false.
  valueType?: 'string' | 'boolean'
  // date: a day, without a time.
  dateOnly?: boolean
}

export type RelativeRange = 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface ConditionRow {
  uid: number
  key: string
  operator: string
  values: string[]
  // text, tags and number; date: the fixed date, as Zammad keeps it (ISO time, or YYYY-MM-DD)
  text: string
  amount: string
  range: RelativeRange
  // owner and person: 'specific', 'not_set' or (triggers) 'current_user.id'
  preCondition: string
  // person: the chosen person's name and email
  completion: string
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
  | 'multichoice'
  | 'owner'
  | 'tags'
  | 'note'
  | 'email'
  | 'webhook'
  | 'delete'
  | 'privacy'
  | 'text'
  | 'richtext'
  | 'date'
  | 'customer'

export interface ActionField {
  key: string
  label: string
  kind: ActionKind
  choices?: ChoiceOption[]
  // date: a day, without a time.
  dateOnly?: boolean
}

export interface ActionRow {
  uid: number
  key: string
  // date: the fixed time (ISO) or, relative, the number of units
  value: string
  // multichoice
  values: string[]
  // tags: 'add' or 'remove'; date: 'static' or 'relative'
  operator: string
  range: RelativeRange
  subject: string
  body: string
  internal: boolean
  recipients: string[]
  // customer: 'specific' or 'current_user.id'; completion is the chosen person's name
  preCondition: string
  completion: string
  // settings this editor doesn't show (e.g. include_attachments, value_completion), kept as they are
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

// Ticket dates that conditions can compare with "now" or a fixed date.
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

// The dates of a user's tickets as customer that jobs on users can compare.
const CUSTOMER_TICKET_DATES: [string, string][] = [
  ['ticket_customer.last_contact_at', __('Last contact')],
  ['ticket_customer.last_contact_agent_at', __('Last contact (agent)')],
  ['ticket_customer.last_contact_customer_at', __('Last contact (customer)')],
  ['ticket_customer.updated_at', __('Updated at')],
]

export const HAS_CHANGED = 'has changed'

const HAS_CHANGED_OPERATOR: ChoiceOption = { value: HAS_CHANGED, label: __('has changed') }

// Time-based triggers run when a ticket's pending time or escalation is reached.
const HAS_REACHED: ChoiceOption = { value: 'has reached', label: __('has been reached') }
const HAS_REACHED_WARNING: ChoiceOption = { value: 'has reached warning', label: __('has reached its warning') }

// Operators about an event or the day itself, without a value to compare with.
const NO_VALUE_OPERATORS = [HAS_CHANGED, 'has reached', 'has reached warning', 'is set', 'not set', 'today']

export const needsValue = (operator: string) => !NO_VALUE_OPERATORS.includes(operator)

// Operators that compare with several texts, entered separated by commas and saved as a list.
const LIST_OPERATORS = ['is any of', 'is none of', 'starts with one of', 'ends with one of']

export const isListOperator = (operator: string) => LIST_OPERATORS.includes(operator)

export const isAbsoluteOperator = (operator: string) =>
  operator === 'before (absolute)' || operator === 'after (absolute)'

export const RELATIVE_OPERATORS: ChoiceOption[] = [
  { value: 'before (relative)', label: __('more than … ago') },
  { value: 'within last (relative)', label: __('within the last …') },
  { value: 'within next (relative)', label: __('within the next …') },
  { value: 'after (relative)', label: __('more than … from now') },
  { value: 'till (relative)', label: __('before … from now') },
  { value: 'from (relative)', label: __('after … ago') },
]

const DATE_OPERATORS: ChoiceOption[] = [
  ...RELATIVE_OPERATORS,
  { value: 'today', label: __('is today') },
  { value: 'before (absolute)', label: __('before the date') },
  { value: 'after (absolute)', label: __('after the date') },
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

// Fields with several values (multiselect) are also compared like tags.
const MULTI_OPERATORS = [...CHOICE_OPERATORS, ...TAG_OPERATORS]

export const TEXT_OPERATORS: ChoiceOption[] = [
  { value: 'contains', label: __('contains') },
  { value: 'contains not', label: __('does not contain') },
  { value: 'is', label: __('is') },
  { value: 'is not', label: __('is not') },
  { value: 'is any of', label: __('is one of') },
  { value: 'is none of', label: __('is none of') },
  { value: 'starts with one of', label: __('starts with one of') },
  { value: 'ends with one of', label: __('ends with one of') },
]

// Long texts (a message, a note) are searched, not compared as a whole.
const LONG_TEXT_OPERATORS = TEXT_OPERATORS.slice(0, 2)

// Triggers only, while Zammad's setting ticket_conditions_allow_regular_expression_operators is on.
const REGEX_OPERATORS: ChoiceOption[] = [
  { value: 'matches regex', label: __('matches the regular expression') },
  { value: 'does not match regex', label: __('does not match the regular expression') },
]

const NUMBER_OPERATORS: ChoiceOption[] = [
  ...CHOICE_OPERATORS,
  { value: 'is less than', label: __('is less than') },
  { value: 'is less than or equal to', label: __('is at most') },
  { value: 'is greater than', label: __('is greater than') },
  { value: 'is greater than or equal to', label: __('is at least') },
]

const WORKING_TIME_OPERATORS: ChoiceOption[] = [
  { value: 'is in working time', label: __('is in the working hours of') },
  { value: 'is not in working time', label: __('is outside the working hours of') },
]

const SET_OPERATORS: ChoiceOption[] = [
  { value: 'is set', label: __('was entered') },
  { value: 'not set', label: __('was not entered') },
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

const PERSON_CHOICES: ChoiceOption[] = [
  { value: 'specific', label: __('this person') },
  { value: 'not_set', label: __('nobody') },
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

// How a ticket made from a template comes in.
const SENDER_TYPES: ChoiceOption[] = [
  { value: 'phone-in', label: __('Inbound call') },
  { value: 'phone-out', label: __('Outbound call') },
  { value: 'email-out', label: __('Email') },
]

const MULTI_TYPES = ['multiselect', 'multi_tree_select']

// Fields that must stay unique; jobs don't set them.
const UNIQUE_FIELDS = ['login', 'email', 'name']

const selectAttributeChoices = (attribute: AutomationAttribute) =>
  attribute.data_type === 'boolean' ? YES_NO : attribute.options

const attributeLabel = (attribute: AutomationAttribute) =>
  attribute.active ? attribute.display : i18n.t('%s (inactive)', attribute.display)

const withHasChanged = (operators: ChoiceOption[]) => [...operators, HAS_CHANGED_OPERATOR]

export const operatorsOf = (field?: ConditionField): ChoiceOption[] => {
  if (field?.operators) return field.operators

  switch (field?.kind) {
    case 'date':
      return DATE_OPERATORS
    case 'tags':
      return TAG_OPERATORS
    case 'text':
      return TEXT_OPERATORS
    case 'number':
      return NUMBER_OPERATORS
    default:
      return CHOICE_OPERATORS
  }
}

export const preConditionsOf = (field?: ConditionField): ChoiceOption[] =>
  field?.preConditions ?? (field?.kind === 'person' ? PERSON_CHOICES : OWNER_CHOICES)

// The label with whose field it is, e.g. "Customer › VIP".
export const fieldLabel = (field: { label: string; group?: string }) =>
  field.group ? i18n.t('%s › %s', i18n.t(field.group), i18n.t(field.label)) : i18n.t(field.label)

// The first field of a key wins: the ones listed here come before those of the object manager.
const uniqueFields = <T extends { key: string }>(fields: T[]) =>
  fields.filter((field, index) => fields.findIndex((other) => other.key === field.key) === index)

const dateConditions = (dates: [string, string][], group?: string): ConditionField[] =>
  dates.map(([key, label]) => ({ key, label, kind: 'date', group }))

// A field of the object manager as a condition: what it is compared with follows its type. Fields
// pointing to other records than people and organizations have fields of their own, or none.
const attributeCondition = (
  options: AutomationOptions,
  prefix: string,
  attribute: AutomationAttribute,
  extra: Partial<ConditionField>,
  textOperators: ChoiceOption[],
): ConditionField | null => {
  const field = { key: `${prefix}.${attribute.name}`, label: attributeLabel(attribute), ...extra }

  if (attribute.relation === 'User') return { ...field, kind: 'person' }
  if (attribute.relation === 'Organization') {
    return { ...field, kind: 'choice', choices: recordChoices(options.organizations) }
  }
  if (attribute.relation) return null

  switch (attribute.data_type) {
    case 'boolean':
    case 'active':
      return { ...field, kind: 'single', choices: YES_NO, valueType: 'boolean' }
    case 'select':
    case 'tree_select':
      return { ...field, kind: 'choice', choices: attribute.options }
    case 'multiselect':
    case 'multi_tree_select':
      return { ...field, kind: 'choice', choices: attribute.options, operators: MULTI_OPERATORS }
    case 'input':
      return { ...field, kind: 'text', operators: textOperators }
    case 'textarea':
    case 'richtext':
      return { ...field, kind: 'text', operators: LONG_TEXT_OPERATORS }
    case 'integer':
      return { ...field, kind: 'number' }
    case 'date':
    case 'datetime':
      return { ...field, kind: 'date', dateOnly: attribute.data_type === 'date' }
    default:
      return null
  }
}

const attributeConditions = (
  options: AutomationOptions,
  prefix: string,
  attributes: AutomationAttribute[] = [],
  extra: Partial<ConditionField> = {},
  textOperators = TEXT_OPERATORS,
) => attributes.flatMap((attribute) => attributeCondition(options, prefix, attribute, extra, textOperators) ?? [])

const calendarCondition = (options: AutomationOptions): ConditionField => ({
  key: 'execution_time.calendar_id',
  label: __('Time of the run'),
  kind: 'single',
  choices: recordChoices(options.calendars ?? []),
  operators: WORKING_TIME_OPERATORS,
  valueType: 'string',
})

const ticketConditionFields = (
  options: AutomationOptions,
  flavour: ConditionFlavour,
  allowRegex: boolean,
): ConditionField[] => {
  const trigger = flavour === 'trigger'
  // A trigger also asks whether a field has just changed.
  const changeable = (operators: ChoiceOption[]) => (trigger ? withHasChanged(operators) : undefined)
  const changeableField = (field: ConditionField): ConditionField =>
    trigger ? { ...field, operators: withHasChanged(operatorsOf(field)) } : field
  const textOperators = trigger && allowRegex ? [...TEXT_OPERATORS, ...REGEX_OPERATORS] : TEXT_OPERATORS
  const people = trigger ? [...PERSON_CHOICES, CURRENT_USER] : PERSON_CHOICES
  const triggerDateOperators = (key: string) => [
    ...withHasChanged(DATE_OPERATORS),
    ...(key === 'ticket.pending_time' || key === 'ticket.escalation_at' ? [HAS_REACHED] : []),
    ...(key === 'ticket.escalation_at' ? [HAS_REACHED_WARNING] : []),
  ]

  return uniqueFields<ConditionField>([
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
    ...options.ticket_attributes.map<ConditionField>((attribute) => {
      const operators = MULTI_TYPES.includes(attribute.data_type) ? MULTI_OPERATORS : CHOICE_OPERATORS
      return {
        key: `ticket.${attribute.name}`,
        label: attributeLabel(attribute),
        kind: 'choice',
        choices: selectAttributeChoices(attribute),
        operators: changeable(operators) ?? operators,
      }
    }),
    { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
    { key: 'ticket.title', label: __('Title'), kind: 'text', operators: changeable(textOperators) ?? textOperators },
    ...DATE_FIELDS.map<ConditionField>(([key, label]) => ({
      key,
      label,
      kind: 'date',
      operators: trigger ? triggerDateOperators(key) : undefined,
    })),
    { key: 'ticket.created_by_id', label: __('Created by'), kind: 'person', preConditions: people },
    { key: 'ticket.updated_by_id', label: __('Updated by'), kind: 'person', preConditions: people },
    { key: 'ticket.mention_user_ids', label: __('Contributors'), kind: 'person', preConditions: people },
    ...attributeConditions(options, 'ticket', options.attributes?.ticket, { preConditions: people }, textOperators).map(
      changeableField,
    ),
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
        ]
      : []),
    {
      key: 'article.sender_id',
      label: __('Message sender'),
      kind: 'choice',
      choices: recordChoices(options.article_senders ?? []),
      operators: changeable(CHOICE_OPERATORS),
    },
    {
      key: 'article.type_id',
      label: __('Message type'),
      kind: 'choice',
      choices: recordChoices(options.article_types ?? []),
      operators: changeable(CHOICE_OPERATORS),
    },
    {
      key: 'article.internal',
      label: __('Internal message'),
      kind: 'single',
      choices: YES_NO,
      operators: changeable(CHOICE_OPERATORS),
      valueType: 'boolean',
    },
    { key: 'article.from', label: __('Message from'), kind: 'text', operators: changeable(textOperators) ?? textOperators },
    { key: 'article.to', label: __('Message to'), kind: 'text', operators: changeable(textOperators) ?? textOperators },
    { key: 'article.cc', label: __('Message CC'), kind: 'text', operators: changeable(textOperators) ?? textOperators },
    { key: 'article.subject', label: __('Message subject'), kind: 'text', operators: changeable(textOperators) ?? textOperators },
    { key: 'article.body', label: __('Message text'), kind: 'text', operators: changeable(LONG_TEXT_OPERATORS) ?? LONG_TEXT_OPERATORS },
    ...(trigger
      ? [
          {
            key: 'article.time_accounting',
            label: __('Time accounted for the message'),
            kind: 'single' as const,
            choices: [],
            operators: SET_OPERATORS,
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
    ...attributeConditions(options, 'customer', options.attributes?.user, { group: __('Customer') }, textOperators),
    ...attributeConditions(options, 'organization', options.attributes?.organization, { group: __('Organization') }, textOperators),
    ...(trigger || flavour === 'scheduler' ? [calendarCondition(options)] : []),
  ])
}

const ticketsOf = (prefix: string, group: string): ConditionField[] => [
  { key: `${prefix}.existing`, label: __('Has tickets'), group, kind: 'single', choices: YES_NO, valueType: 'boolean' },
  { key: `${prefix}.open_existing`, label: __('Has open tickets'), group, kind: 'single', choices: YES_NO, valueType: 'boolean' },
]

const userConditionFields = (options: AutomationOptions): ConditionField[] =>
  uniqueFields([
    { key: 'user.role_ids', label: __('Role'), kind: 'choice', choices: recordChoices(options.roles ?? []) },
    ...dateConditions([
      ['user.last_login', __('Last login')],
      ['user.created_at', __('Created at')],
      ['user.updated_at', __('Updated at')],
    ]),
    ...attributeConditions(options, 'user', options.attributes?.user),
    ...attributeConditions(options, 'organization', options.attributes?.organization, { group: __('Organization') }),
    ...ticketsOf('ticket_customer', __('Tickets as customer')),
    ...dateConditions(CUSTOMER_TICKET_DATES, __('Tickets as customer')),
    ...ticketsOf('ticket_owner', __('Tickets as owner')),
  ])

const organizationConditionFields = (options: AutomationOptions): ConditionField[] =>
  uniqueFields([
    { key: 'organization.members_existing', label: __('Has members'), kind: 'single', choices: YES_NO, valueType: 'boolean' },
    ...dateConditions([
      ['organization.created_at', __('Created at')],
      ['organization.updated_at', __('Updated at')],
    ]),
    ...attributeConditions(options, 'organization', options.attributes?.organization),
  ])

export interface ConditionSettings {
  // Zammad's setting ticket_conditions_allow_regular_expression_operators (triggers only).
  allowRegex?: boolean
}

export const conditionFields = (
  options: AutomationOptions,
  flavour: ConditionFlavour = 'ticket',
  settings: ConditionSettings = {},
): ConditionField[] => {
  if (flavour === 'user') return userConditionFields(options)
  if (flavour === 'organization') return organizationConditionFields(options)

  return ticketConditionFields(options, flavour, Boolean(settings.allowRegex))
}

// A field of the object manager as an action ("Set VIP"). Long texts and fields pointing to other
// records than organizations are left out.
const attributeAction = (
  options: AutomationOptions,
  prefix: string,
  attribute: AutomationAttribute,
): ActionField | null => {
  const field = { key: `${prefix}.${attribute.name}`, label: i18n.t('Set %s', attribute.display) }

  if (attribute.relation === 'Organization') {
    return { ...field, kind: 'choice', choices: recordChoices(options.organizations) }
  }
  if (attribute.relation) return null

  switch (attribute.data_type) {
    case 'boolean':
    case 'active':
      return { ...field, kind: 'choice', choices: YES_NO }
    case 'select':
    case 'tree_select':
      return { ...field, kind: 'choice', choices: attribute.options }
    case 'multiselect':
    case 'multi_tree_select':
      return { ...field, kind: 'multichoice', choices: attribute.options }
    case 'input':
    case 'integer':
      return { ...field, kind: 'text' }
    case 'date':
    case 'datetime':
      return { ...field, kind: 'date', dateOnly: attribute.data_type === 'date' }
    default:
      return null
  }
}

const attributeActions = (options: AutomationOptions, prefix: string, attributes: AutomationAttribute[] = []) =>
  attributes
    .filter((attribute) => attribute.active && !UNIQUE_FIELDS.includes(attribute.name))
    .flatMap((attribute) => attributeAction(options, prefix, attribute) ?? [])

const ticketActionFields = (options: AutomationOptions, flavour: ActionFlavour): ActionField[] => {
  const template = flavour === 'template'

  return [
    { key: 'ticket.state_id', label: __('Set state'), kind: 'choice', choices: recordChoices(options.states) },
    { key: 'ticket.priority_id', label: __('Set priority'), kind: 'choice', choices: recordChoices(options.priorities) },
    { key: 'ticket.group_id', label: __('Move to team'), kind: 'choice', choices: recordChoices(options.groups) },
    { key: 'ticket.owner_id', label: __('Set owner'), kind: 'owner', choices: recordChoices(options.agents) },
    ...attributeActions(options, 'ticket', options.ticket_attributes),
    { key: 'ticket.title', label: __('Set title'), kind: 'text' },
    { key: 'ticket.pending_time', label: __('Set pending till'), kind: 'date' },
    ...(flavour === 'scheduler' ? [] : [{ key: 'ticket.customer_id', label: __('Set customer'), kind: 'customer' as const }]),
    { key: 'ticket.tags', label: __('Tags'), kind: 'tags' },
    ...(template
      ? [
          { key: 'ticket.formSenderType', label: __('Comes in as'), kind: 'choice' as const, choices: SENDER_TYPES },
          { key: 'article.body', label: __('Message text'), kind: 'richtext' as const },
          { key: 'article.cc', label: __('CC'), kind: 'text' as const },
        ]
      : [
          { key: 'article.note', label: __('Add an internal note'), kind: 'note' as const },
          { key: 'notification.email', label: __('Send an email'), kind: 'email' as const },
        ]),
    ...(flavour === 'macro' || template
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
}

export const actionFields = (options: AutomationOptions, flavour: ActionFlavour = 'scheduler'): ActionField[] => {
  if (flavour === 'user') {
    return [
      ...attributeActions(options, 'user', options.attributes?.user),
      { key: 'user.action', label: __('Add a data privacy deletion task'), kind: 'privacy' },
    ]
  }
  if (flavour === 'organization') return attributeActions(options, 'organization', options.attributes?.organization)

  return ticketActionFields(options, flavour)
}

const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null

const asStrings = (value: unknown) =>
  (Array.isArray(value) ? value : value === undefined || value === null || value === '' ? [] : [value]).map(String)

const splitList = (text: string) =>
  text
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const pad = (number: number) => String(number).padStart(2, '0')

// A time as Zammad keeps it (ISO, UTC), for a datetime-local input in the browser's time zone.
export const toLocalInput = (iso: string) => {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return ''

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// What a datetime-local input holds, as Zammad keeps it.
export const fromLocalInput = (local: string) => (local ? new Date(local).toISOString() : '')

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
  completion: '',
})

// What a new action starts with: deleting and the privacy task need no choice.
const STARTING_VALUES: Partial<Record<ActionKind, string>> = {
  delete: 'delete',
  privacy: 'data_privacy_deletion_task',
  date: '1',
}

export const emptyAction = (field: ActionField): ActionRow => ({
  uid: newUid(),
  key: field.key,
  value: STARTING_VALUES[field.kind] ?? '',
  values: [],
  operator: field.kind === 'date' ? 'relative' : 'add',
  range: 'day',
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
  const base = {
    uid: newUid(),
    key,
    operator,
    values: [],
    text: '',
    amount: '1',
    range: 'day' as RelativeRange,
    preCondition: 'specific',
    completion: '',
  }

  if (!field || !data || !operatorsOf(field).some((item) => item.value === operator)) return { ...base, raw: setting }

  if (field.kind === 'owner' || field.kind === 'person') {
    const preCondition = String(data.pre_condition ?? 'specific')
    if (preCondition !== 'specific' && !preConditionsOf(field).some((item) => item.value === preCondition)) {
      return { ...base, raw: setting }
    }
    if (!needsValue(operator)) return { ...base, preCondition }
    return { ...base, preCondition, values: asStrings(data.value), completion: String(data.value_completion ?? '') }
  }

  if (!needsValue(operator)) return base

  switch (field.kind) {
    case 'date':
      return isAbsoluteOperator(operator)
        ? { ...base, text: String(data.value ?? '') }
        : { ...base, amount: String(data.value ?? '1'), range: String(data.range ?? 'day') as RelativeRange }
    case 'tags':
      return { ...base, text: asStrings(data.value).join(', ') }
    case 'text':
      return { ...base, text: isListOperator(operator) ? asStrings(data.value).join(', ') : String(data.value ?? '') }
    case 'number':
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

  // "today" has no value at all: Zammad refuses an empty one.
  if (row.operator === 'today') return { operator: row.operator }
  if (!needsValue(row.operator)) {
    return field?.kind === 'owner' || field?.kind === 'person'
      ? { operator: row.operator, pre_condition: row.preCondition, value: [] }
      : { operator: row.operator, value: [] }
  }

  switch (field?.kind) {
    case 'date':
      return isAbsoluteOperator(row.operator)
        ? { operator: row.operator, value: row.text }
        : { operator: row.operator, value: String(row.amount), range: row.range }
    case 'tags':
    case 'number':
      return { operator: row.operator, value: row.text.trim() }
    case 'text':
      return { operator: row.operator, value: isListOperator(row.operator) ? splitList(row.text) : row.text.trim() }
    case 'owner':
      return row.preCondition === 'specific'
        ? { operator: row.operator, pre_condition: 'specific', value: row.values }
        : { operator: row.operator, pre_condition: row.preCondition, value: [] }
    case 'person':
      return row.preCondition === 'specific'
        ? { operator: row.operator, pre_condition: 'specific', value: row.values[0] ?? '', value_completion: row.completion }
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
      values: [],
      operator: 'add',
      range: 'day',
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
      case 'date':
        return {
          ...base,
          operator: data.operator === 'relative' ? 'relative' : 'static',
          value: String(data.value ?? ''),
          range: String(data.range ?? 'day') as RelativeRange,
        }
      case 'multichoice': {
        const { value, ...rest } = data
        return { ...base, values: asStrings(value), extra: rest }
      }
      default: {
        const { value, ...rest } = data
        return { ...base, value: String(value ?? ''), extra: rest }
      }
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
        case 'date':
          return [
            row.key,
            row.operator === 'relative'
              ? { operator: 'relative', value: row.value, range: row.range }
              : { operator: 'static', value: row.value },
          ]
        case 'multichoice':
          return [row.key, { ...row.extra, value: row.values }]
        default:
          return [row.key, { ...row.extra, value: row.value }]
      }
    }),
  )

// What must be filled in before Zammad accepts the record (Validations::VerifyPerformRulesValidator).
export const conditionProblems = (rows: ConditionRow[], fields: ConditionField[]) =>
  rows
    .filter((row) => row.raw === undefined && needsValue(row.operator))
    .flatMap((row) => {
      const field = fields.find((item) => item.key === row.key)
      if (!field) return []
      const label = fieldLabel(field)

      switch (field.kind) {
        case 'date':
          if (isAbsoluteOperator(row.operator)) return row.text ? [] : [i18n.t('%s: enter a date.', label)]
          return Number(row.amount) > 0 ? [] : [i18n.t('%s: enter a number above 0.', label)]
        case 'tags':
        case 'text':
          return (isListOperator(row.operator) ? splitList(row.text).length : row.text.trim())
            ? []
            : [i18n.t('%s: enter a value.', label)]
        case 'number':
          return row.text.trim() && !Number.isNaN(Number(row.text)) ? [] : [i18n.t('%s: enter a number.', label)]
        case 'owner':
          return row.preCondition !== 'specific' || row.values.length ? [] : [i18n.t('%s: choose at least one.', label)]
        case 'person':
          return row.preCondition !== 'specific' || row.values.length ? [] : [i18n.t('%s: choose a person.', label)]
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
      case 'richtext':
        return row.value.trim() ? [] : [i18n.t('%s: enter a text.', label)]
      case 'customer':
        return row.preCondition !== 'specific' || row.value ? [] : [i18n.t('%s: choose a person.', label)]
      case 'multichoice':
        return row.values.length ? [] : [i18n.t('%s: choose at least one.', label)]
      case 'date':
        if (row.operator === 'relative') {
          return Number(row.value) > 0 ? [] : [i18n.t('%s: enter a number above 0.', label)]
        }
        return row.value ? [] : [i18n.t('%s: enter a date.', label)]
      case 'delete':
      case 'privacy':
        return []
      default:
        return row.value ? [] : [i18n.t('%s: choose a value.', label)]
    }
  })
