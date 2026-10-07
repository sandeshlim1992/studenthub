// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the Knowledge Base page (GET /api/v1/studenthub/knowledge_base and
// /api/v1/studenthub/knowledge_base/answers/:id). Titles are keyed by Knowledge Base language id.

import type { KnowledgeBaseAnswerState } from '#desktop/composables/useStudenthubKnowledgeBaseSearch.ts'

export type { KnowledgeBaseAnswerState }

// Zammad's publishing steps (POST /api/v1/knowledge_bases/:id/answers/:id/<event>).
export type KnowledgeBasePublishingEvent = 'internal' | 'publish' | 'archive' | 'unarchive'

export type KnowledgeBaseTitles = Record<string, string>

export interface KnowledgeBaseLocale {
  id: number
  locale: string
  name: string
  primary: boolean
}

export interface KnowledgeBaseInfo {
  id: number
  active: boolean
  titles: KnowledgeBaseTitles
  locales: KnowledgeBaseLocale[]
  can_create_category: boolean
}

export interface KnowledgeBaseCategory {
  id: number
  parent_id: number | null
  position: number
  icon: string
  titles: KnowledgeBaseTitles
  translation_ids: Record<string, number>
  editable: boolean
}

export interface KnowledgeBaseAnswerRow {
  id: number
  category_id: number
  position: number
  promoted: boolean
  state: KnowledgeBaseAnswerState
  titles: KnowledgeBaseTitles
  updated_at: string
  editable: boolean
}

export interface KnowledgeBaseTree {
  knowledge_base: KnowledgeBaseInfo | null
  categories: KnowledgeBaseCategory[]
  answers: KnowledgeBaseAnswerRow[]
}

export interface KnowledgeBaseAnswerTranslation {
  id: number
  kb_locale_id: number
  title: string
  content_id: number | null
  body: string
  updated_at: string
  updated_by: string | null
}

export interface KnowledgeBaseAttachment {
  id: number
  filename: string
  size: number
  content_type: string | null
}

export interface KnowledgeBaseAnswerDetail {
  id: number
  knowledge_base_id: number
  category_id: number
  state: KnowledgeBaseAnswerState
  promoted: boolean
  editable: boolean
  translations: KnowledgeBaseAnswerTranslation[]
  attachments: KnowledgeBaseAttachment[]
  tags: string[]
  internal_at: string | null
  published_at: string | null
  archived_at: string | null
  updated_at: string
}
