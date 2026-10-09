// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: a request form as the person raising a ticket gets it (see StudenthubRequestFormSection).

export interface StudenthubRequestFormField {
  name: string
  required: boolean
}

export interface StudenthubRequestFormDefinition {
  sub_category: string
  title?: string
  help_text?: string
  fields: StudenthubRequestFormField[]
}
