// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { StudenthubRequestFormField } from '#desktop/components/StudenthubRequestForm/types.ts'

// Student Hub: request forms (Administration → Request forms), as the
// /api/v1/studenthub/request_forms endpoints send them.

export interface RequestFormDefinition {
  category: string
  sub_category: string
  title: string
  help_text: string
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
  fields: [],
  organization_ids: [],
  role_ids: [],
})
