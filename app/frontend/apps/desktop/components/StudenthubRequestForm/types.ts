// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: a request form as the person raising a ticket gets it (see StudenthubRequestFormSection).

export interface StudenthubRequestFormField {
  name: string
  required: boolean
}

export type StudenthubRequestFormQuestionKind =
  | 'text'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'integer'

// A question of the form itself (not a Zammad ticket field): its answers are sent with the
// ticket's first message and saved by Student Hub. The key never changes once it is set.
export interface StudenthubRequestFormQuestion {
  type: 'question'
  key: string
  label: string
  kind: StudenthubRequestFormQuestionKind
  help: string
  required: boolean
  // Dropdowns and multi-selects.
  options?: string[]
}

// The form in order: its own questions, Zammad ticket fields, headings between groups of questions
// and notes.
export type StudenthubRequestFormItem =
  | StudenthubRequestFormQuestion
  | ({ type: 'field' } & StudenthubRequestFormField)
  | { type: 'heading'; text: string }
  | { type: 'note'; text: string }

export interface StudenthubRequestFormDefinition {
  id?: number
  sub_category: string
  title?: string
  help_text?: string
  items?: StudenthubRequestFormItem[]
  // The Zammad fields alone, in order (derived from the items).
  fields: StudenthubRequestFormField[]
}

// What the form gives back when it is sent: the Zammad fields' values (they become ticket
// attributes) and the answers to its own questions (key => value).
export interface StudenthubRequestFormResult {
  fields: Record<string, unknown>
  answers: Record<string, unknown>
}

// The form's own questions are named so in the form, apart from Zammad's fields.
export const QUESTION_FIELD_PREFIX = 'studenthub_question__'

// The form's items; a form from before items has only its fields.
export const requestFormItems = (form: StudenthubRequestFormDefinition): StudenthubRequestFormItem[] =>
  form.items ?? form.fields.map((field) => ({ type: 'field', ...field }))

// The Zammad fields of a list of items, as the definition's `fields`.
export const requestFormFields = (items: StudenthubRequestFormItem[]): StudenthubRequestFormField[] =>
  items.flatMap((item) => (item.type === 'field' ? [{ name: item.name, required: item.required }] : []))
