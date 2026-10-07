// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: full-text search of Knowledge Base answers (GET /api/v1/studenthub/knowledge_base/search),
// for the top bar's quick search and the Knowledge Base page.

export type KnowledgeBaseAnswerState = 'draft' | 'internal' | 'published' | 'archived'

export const studenthubKnowledgeBaseAnswerPath = (id: number) => `/knowledge-base/answer/${id}`
export const studenthubKnowledgeBaseSearchPath = (query: string) =>
  `/knowledge-base?${new URLSearchParams({ search: query })}`

export interface KnowledgeBaseSearchResult {
  id: number
  kb_locale_id: number
  title: string
  snippet: string
  category_id: number
  state: KnowledgeBaseAnswerState
  updated_at: string
}

// Staff with Knowledge Base access (students read the public help center).
export const useStudenthubKnowledgeBaseAccess = () => {
  const { hasPermission } = useSessionStore()

  return computed(
    () =>
      hasPermission(['ticket.agent', 'admin']) &&
      hasPermission(['knowledge_base.reader', 'knowledge_base.editor']),
  )
}

export const useStudenthubKnowledgeBaseSearch = (
  term: MaybeRefOrGetter<string>,
  { limit = 10, enabled = () => true }: { limit?: number; enabled?: () => boolean } = {},
) => {
  const results = ref<KnowledgeBaseSearchResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let latest = 0

  const search = async (query: string) => {
    const request = ++latest
    if (!query.trim() || !enabled()) {
      results.value = []
      error.value = null
      return
    }

    isLoading.value = true
    try {
      const params = new URLSearchParams({ query, limit: String(limit) })
      const found = await studenthubApi<KnowledgeBaseSearchResult[]>(
        `/api/v1/studenthub/knowledge_base/search?${params}`,
      )
      // Only the answer to the last search counts.
      if (request !== latest) return
      results.value = found
      error.value = null
    } catch (searchError) {
      if (request !== latest) return
      results.value = []
      error.value = (searchError as Error).message
    } finally {
      if (request === latest) isLoading.value = false
    }
  }

  watch(() => toValue(term), search, { immediate: true })

  return { results, isLoading, error }
}
