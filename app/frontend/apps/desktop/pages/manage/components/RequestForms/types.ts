// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type {
  StudenthubRequestFormField,
  StudenthubRequestFormItem,
  StudenthubRequestFormQuestionKind,
} from '#desktop/components/StudenthubRequestForm/types.ts'

// Student Hub: request forms (Administration → Request forms), as the
// /api/v1/studenthub/request_forms endpoints send them.

export interface RequestFormDefinition {
  category: string
  sub_category: string
  title: string
  help_text: string
  // The form in order: questions, headings and notes.
  items: StudenthubRequestFormItem[]
  // The questions alone, kept in step with the items (the server derives them too).
  fields: StudenthubRequestFormField[]
  organization_ids: number[]
  role_ids: number[]
}

// draft: never published; published: what applies is the draft; changed: the draft has changes
// that don't apply yet.
export type RequestFormStatus = 'draft' | 'published' | 'changed'

export interface RequestForm {
  id: number
  draft: RequestFormDefinition
  published: RequestFormDefinition | null
  status: RequestFormStatus
  problems: string[]
  published_problems: string[]
  published_at: string | null
  published_by: string | null
  updated_at: string
}

export interface RequestFormOption {
  value: string
  label: string
}

export interface RequestFormFieldChoice {
  name: string
  display: string
  data_type: string
  // Who sees the field on New ticket by its own settings, request form or not (none: only the
  // forms that ask for it show it).
  shown_for: ('customers' | 'staff')[]
}

export interface RequestFormOptions {
  categories: RequestFormOption[]
  sub_categories: Record<string, RequestFormOption[]>
  fields: RequestFormFieldChoice[]
  organizations: { id: number; name: string }[]
  roles: { id: number; name: string }[]
}

export const emptyDefinition = (): RequestFormDefinition => ({
  category: '',
  sub_category: '',
  title: '',
  help_text: '',
  items: [],
  fields: [],
  organization_ids: [],
  role_ids: [],
})

// The types of a form's own questions, as admins choose them.
export const QUESTION_KIND_LABELS: Record<StudenthubRequestFormQuestionKind, string> = {
  text: __('Short text'),
  textarea: __('Long text'),
  select: __('Dropdown'),
  multiselect: __('Multi-select'),
  date: __('Date'),
  datetime: __('Date and time'),
  boolean: __('Yes / no'),
  integer: __('Number'),
}

// A new question's key: from its label, unique in the form, never changed afterwards (the server
// makes the same kind of key).
export const questionKey = (label: string, taken: string[]) => {
  const base =
    label
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'question'

  let key = base
  for (let number = 2; taken.includes(key); number += 1) key = `${base}_${number}`
  return key
}
