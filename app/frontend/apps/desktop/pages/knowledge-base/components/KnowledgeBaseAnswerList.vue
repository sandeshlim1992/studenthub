<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseStateBadge from './KnowledgeBaseStateBadge.vue'

import type { KnowledgeBaseAnswerRow } from '../types.ts'

defineProps<{ answers: KnowledgeBaseAnswerRow[]; showCategory?: boolean }>()

const { titleOf, categoryById } = useStudenthubKnowledgeBase()
</script>

<template>
  <ul class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
    <li v-for="answer in answers" :key="answer.id">
      <RouterLink
        :to="knowledgeBasePaths.answer(answer.id)"
        class="flex items-center gap-3 px-4 py-3 hover:bg-[var(--sh-app-soft)] focus-visible:outline-2 focus-visible:outline-[var(--sh-app)]"
      >
        <CommonIcon name="file-text" size="small" class="shrink-0 text-[var(--sh-app)]" decorative />
        <span class="flex min-w-0 grow flex-col">
          <span class="truncate font-semibold text-[var(--sh-ink)]">{{ titleOf(answer.titles) }}</span>
          <span v-if="showCategory && categoryById(answer.category_id)" class="truncate text-xs text-[var(--sh-muted)]">
            {{ titleOf(categoryById(answer.category_id)!.titles) }}
          </span>
        </span>
        <KnowledgeBaseStateBadge :state="answer.state" />
        <CommonDateTime :date-time="answer.updated_at" type="relative" class="shrink-0 text-xs text-[var(--sh-muted)]" />
      </RouterLink>
    </li>
  </ul>
</template>
