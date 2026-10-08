// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import KnowledgeBaseCategoryFlyout from '../components/KnowledgeBaseCategoryFlyout.vue'
import {
  resetStudenthubKnowledgeBase,
  useStudenthubKnowledgeBase,
} from '../composables/useStudenthubKnowledgeBase.ts'

import type { KnowledgeBaseTree } from '../types.ts'

const tree: KnowledgeBaseTree = {
  knowledge_base: {
    id: 3,
    active: true,
    titles: { '4': 'IT Help' },
    locales: [{ id: 4, locale: 'en-us', name: 'English', primary: true }],
    can_create_category: true,
  },
  categories: [
    { id: 6, parent_id: null, position: 0, icon: 'f0eb', titles: { '4': 'How-To Guides' }, translation_ids: { '4': 60 }, editable: true },
    { id: 7, parent_id: 6, position: 0, icon: 'f1eb', titles: { '4': 'Wi-Fi' }, translation_ids: { '4': 70 }, editable: true },
  ],
  answers: [],
}

const requests: { method: string; url: string; body: unknown }[] = []

const renderFlyout = async (props: Record<string, unknown>) => {
  await useStudenthubKnowledgeBase().load()
  requests.length = 0

  return renderComponent(KnowledgeBaseCategoryFlyout, {
    props,
    router: true,
    form: true,
    flyout: true,
    store: true,
  })
}

describe('Knowledge Base category panel', () => {
  beforeEach(() => {
    resetStudenthubKnowledgeBase()
    setCSRFToken('token-1')
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit = {}) => {
        requests.push({
          method: init.method ?? 'GET',
          url,
          body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body,
        })
        if (url === '/api/v1/studenthub/knowledge_base') return new Response(JSON.stringify(tree))
        return new Response(JSON.stringify({ id: 9 }), { status: 201 })
      }),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a sub-category with the default icon', async () => {
    const view = await renderFlyout({ parentId: 6 })

    expect(view.getByRole('heading', { name: 'New category' })).toBeInTheDocument()
    await view.events.type(view.getByLabelText('Title'), 'Printers')
    await view.events.click(view.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(requests.some((request) => request.method === 'POST')).toBe(true))
    expect(requests.find((request) => request.method === 'POST')).toEqual({
      method: 'POST',
      url: '/api/v1/knowledge_bases/3/categories',
      body: {
        knowledge_base_id: 3,
        parent_id: 6,
        category_icon: 'f02d',
        translations_attributes: [{ kb_locale_id: 4, title: 'Printers' }],
      },
    })
  })

  it('renames a category and keeps its place and icon', async () => {
    const view = await renderFlyout({ categoryId: 7 })

    expect(view.getByRole('heading', { name: 'Edit category' })).toBeInTheDocument()
    const title = view.getByLabelText('Title')
    expect(title).toHaveValue('Wi-Fi')
    await view.events.clear(title)
    await view.events.type(title, 'Wireless')
    await view.events.click(view.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(requests.some((request) => request.method === 'PATCH')).toBe(true))
    expect(requests.find((request) => request.method === 'PATCH')?.body).toEqual({
      knowledge_base_id: 3,
      parent_id: 6,
      category_icon: 'f1eb',
      translations_attributes: [{ id: 70, kb_locale_id: 4, title: 'Wireless' }],
    })
  })
})
