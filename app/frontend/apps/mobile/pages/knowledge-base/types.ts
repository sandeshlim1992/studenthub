// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the mobile app's Knowledge Base, as GET /api/v1/studenthub/mobile_app/knowledge_base…
// sends it (Studenthub::MobileApp::KnowledgeBase). Only what the help center publishes.

export interface KnowledgeBaseTopicLink {
  id: number
  title: string
}

export interface KnowledgeBaseTopicTile extends KnowledgeBaseTopicLink {
  icon: string
  answer_count: number
}

export interface KnowledgeBaseTopic {
  topic: (KnowledgeBaseTopicLink & { path: KnowledgeBaseTopicLink[] }) | null
  topics: KnowledgeBaseTopicTile[]
  answers: KnowledgeBaseTopicLink[]
}

export interface KnowledgeBaseSearchResult extends KnowledgeBaseTopicLink {
  topic: string
  snippet: string
}

export interface KnowledgeBaseAnswer extends KnowledgeBaseTopicLink {
  body: string
  updated_at: string
  path: KnowledgeBaseTopicLink[]
  attachments: { id: number; filename: string; size: number }[]
  helpful: boolean | null
}
