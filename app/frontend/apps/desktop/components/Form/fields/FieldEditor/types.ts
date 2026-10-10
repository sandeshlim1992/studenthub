// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { MaybeRefOrGetter } from 'vue'

export interface FieldEditorOptions {
  zIndex?: string
  // Student Hub: the tools shown in the toolbar (by action name); the others go into its overflow
  // menu. Undefined shows them all.
  toolbarActions?: MaybeRefOrGetter<string[] | undefined>
}
