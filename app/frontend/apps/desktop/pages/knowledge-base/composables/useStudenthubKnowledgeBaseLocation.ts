// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useStudenthubKnowledgeBase } from './useStudenthubKnowledgeBase.ts'

// Student Hub: what the Knowledge Base path points at (see routes.ts), for the page and the
// navigation panel.

export const useStudenthubKnowledgeBaseLocation = () => {
  const route = useRoute()
  const { categoryById, answerById } = useStudenthubKnowledgeBase()

  const kind = computed(() => (route.params.kind as string | undefined) || null)
  const id = computed(() => (route.params.id ? Number(route.params.id) : null))
  const mode = computed(() => (route.params.mode as string | undefined) || null)
  const searchQuery = computed(() =>
    typeof route.query.search === 'string' ? route.query.search.trim() : '',
  )

  const category = computed(() => (kind.value === 'category' ? categoryById(id.value) : undefined))
  const answerRow = computed(() => (kind.value === 'answer' ? answerById(id.value) : undefined))

  // The category shown, or the one of the answer shown.
  const activeCategoryId = computed(
    () => category.value?.id ?? answerRow.value?.category_id ?? null,
  )

  return { kind, id, mode, searchQuery, category, answerRow, activeCategoryId }
}
