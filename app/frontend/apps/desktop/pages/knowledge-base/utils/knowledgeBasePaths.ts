// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { KnowledgeBaseAnswerState } from '../types.ts'

export const knowledgeBasePaths = {
  home: () => '/knowledge-base',
  category: (id: number) => `/knowledge-base/category/${id}`,
  newAnswer: (categoryId: number) => `/knowledge-base/category/${categoryId}/new`,
  answer: (id: number) => `/knowledge-base/answer/${id}`,
  editAnswer: (id: number) => `/knowledge-base/answer/${id}/edit`,
}

export const KNOWLEDGE_BASE_CATEGORY_FLYOUT = 'studenthub-kb-category'

export const knowledgeBaseStateLabels: Record<KnowledgeBaseAnswerState, string> = {
  draft: __('Draft'),
  internal: __('Internal'),
  published: __('Public'),
  archived: __('Archived'),
}

// Icons the public help center draws for categories (Font Awesome 4 codes, as the classic UI
// stores them).
export const knowledgeBaseCategoryIcons: { value: string; label: string }[] = [
  { value: 'f02d', label: __('Book') },
  { value: 'f0eb', label: __('Light bulb') },
  { value: 'f128', label: __('Question mark') },
  { value: 'f05a', label: __('Information') },
  { value: 'f0a1', label: __('Announcement') },
  { value: 'f0ad', label: __('Wrench') },
  { value: 'f013', label: __('Cog') },
  { value: 'f108', label: __('Computer') },
  { value: 'f10b', label: __('Mobile phone') },
  { value: 'f1eb', label: __('Wi-Fi') },
  { value: 'f023', label: __('Lock') },
  { value: 'f084', label: __('Key') },
  { value: 'f0e0', label: __('Envelope') },
  { value: 'f007', label: __('Person') },
  { value: 'f0c0', label: __('People') },
  { value: 'f19d', label: __('Graduation cap') },
  { value: 'f15c', label: __('Document') },
  { value: 'f07b', label: __('Folder') },
]
