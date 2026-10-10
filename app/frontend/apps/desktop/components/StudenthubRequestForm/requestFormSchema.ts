// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { FormSchemaNode, FormValues } from '#shared/components/Form/types.ts'
import { EnumObjectManagerObjects } from '#shared/graphql/types.ts'

import {
  QUESTION_FIELD_PREFIX,
  requestFormItems,
  type StudenthubRequestFormDefinition,
  type StudenthubRequestFormQuestion,
  type StudenthubRequestFormQuestionKind,
  type StudenthubRequestFormResult,
} from './types.ts'

export const HEADING_CLASS = 'col-span-full mt-2 text-sm font-semibold text-slate-900'
export const NOTE_CLASS = 'col-span-full text-sm leading-relaxed whitespace-pre-line text-slate-600'

// Text in a form schema that starts with "$" would be read as an expression.
const literal = (text: string) => text.replace(/^\$/, '\\$')

// The Zammad form field each kind of question is drawn with.
const QUESTION_FIELD_TYPES: Record<StudenthubRequestFormQuestionKind, string> = {
  text: 'text',
  textarea: 'textarea',
  select: 'select',
  multiselect: 'select',
  date: 'date',
  datetime: 'datetime',
  boolean: 'toggle',
  integer: 'number',
}

const questionProps = (question: StudenthubRequestFormQuestion) => {
  if (question.kind === 'boolean') return { variants: { true: __('yes'), false: __('no') } }
  if (question.kind !== 'select' && question.kind !== 'multiselect') return {}

  return {
    options: (question.options ?? []).map((option) => ({ value: option, label: literal(option) })),
    noOptionsLabelTranslation: true,
    clearable: true,
    multiple: question.kind === 'multiselect',
  }
}

const questionField = (question: StudenthubRequestFormQuestion): FormSchemaNode => ({
  type: QUESTION_FIELD_TYPES[question.kind],
  name: `${QUESTION_FIELD_PREFIX}${question.key}`,
  label: literal(question.label),
  ...(question.help ? { help: literal(question.help) } : {}),
  // A yes / no question always has an answer.
  required: question.required && question.kind !== 'boolean',
  ...(question.kind === 'boolean' ? { value: false } : {}),
  props: questionProps(question),
})

// Student Hub: a request form as Zammad form schema: its own questions and Zammad fields in order,
// with its headings and notes between them (see StudenthubRequestFormSection).
export const requestFormSchema = (form: StudenthubRequestFormDefinition): FormSchemaNode[] =>
  requestFormItems(form).map((item) => {
    if (item.type === 'heading')
      return { isLayout: true, element: 'h4', attrs: { class: HEADING_CLASS }, children: literal(item.text) }

    if (item.type === 'note')
      return { isLayout: true, element: 'p', attrs: { class: NOTE_CLASS }, children: literal(item.text) }

    if (item.type === 'question') return questionField(item)

    return { name: item.name, object: EnumObjectManagerObjects.Ticket, required: item.required }
  })

// The form's values split into the Zammad fields' values and the answers to its own questions.
export const splitRequestFormValues = (values: FormValues): StudenthubRequestFormResult => {
  const result: StudenthubRequestFormResult = { fields: {}, answers: {} }

  Object.entries(values).forEach(([name, value]) => {
    if (name.startsWith(QUESTION_FIELD_PREFIX))
      result.answers[name.slice(QUESTION_FIELD_PREFIX.length)] = value
    else result.fields[name] = value
  })

  return result
}
