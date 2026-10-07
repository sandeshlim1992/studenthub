// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { i18n } from '#shared/i18n/index.ts'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import type {
  KnowledgeBaseAnswerDetail,
  KnowledgeBaseAnswerRow,
  KnowledgeBaseCategory,
  KnowledgeBasePublishingEvent,
  KnowledgeBaseTitles,
  KnowledgeBaseTree,
} from '../types.ts'

// Student Hub: state of the Knowledge Base page, shared by its panels. Reading uses Student Hub's
// endpoints; every change goes through Zammad's Knowledge Base API, which checks the user's rights.

const tree = ref<KnowledgeBaseTree | null>(null)
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const selectedLocaleId = ref<number | null>(null)

export const resetStudenthubKnowledgeBase = () => {
  tree.value = null
  isLoading.value = false
  loadError.value = null
  selectedLocaleId.value = null
}

const byPosition = <T extends { position: number; id: number }>(a: T, b: T) =>
  a.position - b.position || a.id - b.id

export const useStudenthubKnowledgeBase = () => {
  const knowledgeBase = computed(() => tree.value?.knowledge_base ?? null)
  const categories = computed(() => tree.value?.categories ?? [])
  const answers = computed(() => tree.value?.answers ?? [])

  const primaryLocaleId = computed(
    () => knowledgeBase.value?.locales.find((locale) => locale.primary)?.id ?? knowledgeBase.value?.locales[0]?.id ?? null,
  )
  const localeId = computed({
    get: () => selectedLocaleId.value ?? primaryLocaleId.value,
    set: (value) => {
      selectedLocaleId.value = value
    },
  })

  const titleOf = (titles: KnowledgeBaseTitles) =>
    titles[String(localeId.value)] ||
    titles[String(primaryLocaleId.value)] ||
    Object.values(titles).find(Boolean) ||
    i18n.t('Untitled')

  const knowledgeBaseTitle = computed(() =>
    knowledgeBase.value ? titleOf(knowledgeBase.value.titles) : i18n.t('Knowledge Base'),
  )

  const categoryById = (id?: number | null) =>
    id ? categories.value.find((category) => category.id === id) : undefined

  const answerById = (id?: number | null) => (id ? answers.value.find((answer) => answer.id === id) : undefined)

  const childrenOf = (parentId: number | null) =>
    categories.value.filter((category) => category.parent_id === parentId).sort(byPosition)

  const answersOf = (categoryId: number) =>
    answers.value.filter((answer) => answer.category_id === categoryId).sort(byPosition)

  // Root first, the category itself last.
  const ancestorsOf = (categoryId?: number | null) => {
    const chain: KnowledgeBaseCategory[] = []
    let category = categoryById(categoryId)
    while (category && !chain.includes(category)) {
      chain.unshift(category)
      category = categoryById(category.parent_id)
    }
    return chain
  }

  // Answers in the category and all its sub-categories.
  const answerCount = (categoryId: number): number =>
    answersOf(categoryId).length +
    childrenOf(categoryId).reduce((sum, child) => sum + answerCount(child.id), 0)

  const recentAnswers = (limit = 8): KnowledgeBaseAnswerRow[] =>
    [...answers.value].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, limit)

  const load = async () => {
    isLoading.value = true
    try {
      tree.value = await studenthubApi<KnowledgeBaseTree>('/api/v1/studenthub/knowledge_base')
      loadError.value = null
    } catch (error) {
      loadError.value = (error as Error).message
    } finally {
      isLoading.value = false
    }
  }

  const base = () => `/api/v1/knowledge_bases/${knowledgeBase.value?.id}`

  const loadAnswer = (id: number) =>
    studenthubApi<KnowledgeBaseAnswerDetail>(`/api/v1/studenthub/knowledge_base/answers/${id}`)

  const saveAnswer = async ({
    id,
    categoryId,
    translationId,
    title,
    body,
  }: {
    id?: number
    categoryId: number
    translationId?: number
    title: string
    body: string
  }) => {
    const payload = {
      category_id: categoryId,
      translations_attributes: [
        {
          ...(translationId ? { id: translationId } : {}),
          kb_locale_id: localeId.value,
          title,
          content_attributes: { body },
        },
      ],
    }

    const result = id
      ? await studenthubApi<{ id: number }>(`${base()}/answers/${id}`, { method: 'PATCH', body: payload })
      : await studenthubApi<{ id: number }>(`${base()}/answers`, { method: 'POST', body: payload })

    await load()
    return result.id
  }

  const changeAnswerState = async (id: number, event: KnowledgeBasePublishingEvent) => {
    await studenthubApi(`${base()}/answers/${id}/${event}`, { method: 'POST' })
    await load()
  }

  const deleteAnswer = async (id: number) => {
    await studenthubApi(`${base()}/answers/${id}`, { method: 'DELETE' })
    await load()
  }

  const uploadAttachment = (answerId: number, file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return studenthubApi(`${base()}/answers/${answerId}/attachments`, { method: 'POST', formData })
  }

  const deleteAttachment = (answerId: number, attachmentId: number) =>
    studenthubApi(`${base()}/answers/${answerId}/attachments/${attachmentId}`, { method: 'DELETE' })

  const saveCategory = async ({
    id,
    parentId,
    icon,
    title,
  }: {
    id?: number
    parentId: number | null
    icon: string
    title: string
  }) => {
    const translationId = categoryById(id)?.translation_ids[String(localeId.value)]
    const payload = {
      knowledge_base_id: knowledgeBase.value?.id,
      parent_id: parentId,
      category_icon: icon,
      translations_attributes: [
        { ...(translationId ? { id: translationId } : {}), kb_locale_id: localeId.value, title },
      ],
    }

    const result = id
      ? await studenthubApi<{ id: number }>(`${base()}/categories/${id}`, { method: 'PATCH', body: payload })
      : await studenthubApi<{ id: number }>(`${base()}/categories`, { method: 'POST', body: payload })

    await load()
    return result.id
  }

  const deleteCategory = async (id: number) => {
    await studenthubApi(`${base()}/categories/${id}`, { method: 'DELETE' })
    await load()
  }

  return {
    tree,
    isLoading,
    loadError,
    knowledgeBase,
    knowledgeBaseTitle,
    categories,
    answers,
    localeId,
    primaryLocaleId,
    titleOf,
    categoryById,
    answerById,
    childrenOf,
    answersOf,
    ancestorsOf,
    answerCount,
    recentAnswers,
    load,
    loadAnswer,
    saveAnswer,
    changeAnswerState,
    deleteAnswer,
    uploadAttachment,
    deleteAttachment,
    saveCategory,
    deleteCategory,
  }
}
