<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { knowledgeBaseStateLabels } from '../utils/knowledgeBasePaths.ts'

import type { KnowledgeBaseAnswerState } from '../types.ts'

defineProps<{ state: KnowledgeBaseAnswerState }>()

const classes: Record<KnowledgeBaseAnswerState, string> = {
  draft: 'bg-slate-100 text-slate-700',
  internal: 'bg-amber-50 text-amber-800',
  published: 'bg-emerald-50 text-emerald-800',
  archived: 'bg-slate-200 text-slate-600',
}
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-xs font-semibold"
    :class="classes[state]"
  >
    {{ $t(knowledgeBaseStateLabels[state]) }}
  </span>
</template>
