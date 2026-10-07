// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import {
  resetStudenthubKnowledgeBase,
  useStudenthubKnowledgeBase,
} from '../composables/useStudenthubKnowledgeBase.ts'

import type { KnowledgeBaseTree } from '../types.ts'

const tree: KnowledgeBaseTree = {
  knowledge_base: {
    id: 3,
    active: true,
    titles: { '4': 'IT Help', '5': 'IT-Hilfe' },
    locales: [
      { id: 4, locale: 'en-us', name: 'English', primary: true },
      { id: 5, locale: 'de-de', name: 'Deutsch', primary: false },
    ],
    can_create_category: true,
  },
  categories: [
    { id: 6, parent_id: null, position: 1, icon: 'f0eb', titles: { '4': 'Guides' }, translation_ids: { '4': 60 }, editable: true },
    { id: 7, parent_id: 6, position: 0, icon: 'f1eb', titles: { '4': 'Wi-Fi', '5': 'WLAN' }, translation_ids: { '4': 70, '5': 71 }, editable: true },
    { id: 8, parent_id: null, position: 0, icon: 'f128', titles: { '4': 'FAQs' }, translation_ids: { '4': 80 }, editable: true },
  ],
  answers: [
    { id: 11, category_id: 7, position: 0, promoted: false, state: 'published', titles: { '4': 'Eduroam' }, updated_at: '2026-10-01T10:00:00Z', editable: true },
    { id: 12, category_id: 6, position: 0, promoted: false, state: 'draft', titles: { '4': 'Printing' }, updated_at: '2026-10-02T10:00:00Z', editable: true },
  ],
}

const requests: { method: string; url: string; body: unknown; headers: Record<string, string> }[] = []

describe('useStudenthubKnowledgeBase', () => {
  beforeEach(async () => {
    requests.length = 0
    resetStudenthubKnowledgeBase()
    setCSRFToken('token-1')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        requests.push({
          method: init.method ?? 'GET',
          url,
          body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
          headers: init.headers as Record<string, string>,
        })
        if (url === '/api/v1/studenthub/knowledge_base') return new Response(JSON.stringify(tree))
        return new Response(JSON.stringify({ id: 42 }), { status: 201 })
      }),
    )
    await useStudenthubKnowledgeBase().load()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sorts categories, counts answers in sub-categories and finds the way to a category', () => {
    const { childrenOf, answerCount, ancestorsOf } = useStudenthubKnowledgeBase()

    expect(childrenOf(null).map((category) => category.id)).toEqual([8, 6])
    expect(answerCount(6)).toBe(2)
    expect(ancestorsOf(7).map((category) => category.id)).toEqual([6, 7])
  })

  it('shows titles in the chosen language, falling back to the main one', () => {
    const { titleOf, localeId, categoryById } = useStudenthubKnowledgeBase()

    localeId.value = 5
    expect(titleOf(categoryById(7)!.titles)).toBe('WLAN')
    expect(titleOf(categoryById(6)!.titles)).toBe('Guides')
  })

  it('creates an answer in the chosen language through Zammad, with the CSRF token', async () => {
    const { saveAnswer } = useStudenthubKnowledgeBase()

    const id = await saveAnswer({ categoryId: 7, title: 'Eduroam on Android', body: '<p>Steps</p>' })

    expect(id).toBe(42)
    const create = requests.find((request) => request.method === 'POST')
    expect(create?.url).toBe('/api/v1/knowledge_bases/3/answers')
    expect(create?.headers['X-CSRF-Token']).toBe('token-1')
    expect(create?.body).toEqual({
      category_id: 7,
      translations_attributes: [{ kb_locale_id: 4, title: 'Eduroam on Android', content_attributes: { body: '<p>Steps</p>' } }],
    })
  })

  it('updates an answer and its translation', async () => {
    const { saveAnswer } = useStudenthubKnowledgeBase()

    await saveAnswer({ id: 11, categoryId: 6, translationId: 110, title: 'Eduroam', body: '<p>New</p>' })

    const update = requests.find((request) => request.method === 'PATCH')
    expect(update?.url).toBe('/api/v1/knowledge_bases/3/answers/11')
    expect(update?.body).toEqual({
      category_id: 6,
      translations_attributes: [{ id: 110, kb_locale_id: 4, title: 'Eduroam', content_attributes: { body: '<p>New</p>' } }],
    })
  })

  it('renames a category in the chosen language, keeping its translation', async () => {
    const { saveCategory, localeId } = useStudenthubKnowledgeBase()

    localeId.value = 5
    await saveCategory({ id: 7, parentId: 6, icon: 'f1eb', title: 'Drahtlos' })

    const update = requests.find((request) => request.method === 'PATCH')
    expect(update?.url).toBe('/api/v1/knowledge_bases/3/categories/7')
    expect(update?.body).toEqual({
      knowledge_base_id: 3,
      parent_id: 6,
      category_icon: 'f1eb',
      translations_attributes: [{ id: 71, kb_locale_id: 5, title: 'Drahtlos' }],
    })
  })

  it('publishes and deletes through Zammad and reloads the tree', async () => {
    const { changeAnswerState, deleteAnswer } = useStudenthubKnowledgeBase()

    await changeAnswerState(12, 'publish')
    await deleteAnswer(12)

    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET /api/v1/studenthub/knowledge_base',
      'POST /api/v1/knowledge_bases/3/answers/12/publish',
      'GET /api/v1/studenthub/knowledge_base',
      'DELETE /api/v1/knowledge_bases/3/answers/12',
      'GET /api/v1/studenthub/knowledge_base',
    ])
  })
})
