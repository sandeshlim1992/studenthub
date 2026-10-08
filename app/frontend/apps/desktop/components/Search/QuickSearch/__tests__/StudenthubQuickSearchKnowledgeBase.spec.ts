// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import StudenthubQuickSearchKnowledgeBase from '../StudenthubQuickSearchKnowledgeBase.vue'

const answers = Array.from({ length: 6 }, (_, index) => ({
  id: 20 + index,
  kb_locale_id: 4,
  title: `Printer guide ${index + 1}`,
  snippet: 'How to print.',
  category_id: 7,
  state: 'published',
  updated_at: '2026-10-05T10:00:00Z',
}))

describe('Knowledge Base answers in the quick search', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists five answers and links to the rest', async () => {
    mockPermissions(['ticket.agent', 'knowledge_base.reader'])
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(answers)))
    vi.stubGlobal('fetch', fetchMock)

    const view = renderComponent(StudenthubQuickSearchKnowledgeBase, {
      props: { search: 'printer' },
      router: true,
      store: true,
    })

    expect(await view.findByRole('link', { name: 'Printer guide 1' })).toHaveAttribute(
      'href',
      '/desktop/knowledge-base/answer/20',
    )
    expect(view.getAllByRole('link', { name: /Printer guide/ })).toHaveLength(5)
    expect(view.getByRole('link', { name: 'More in the Knowledge Base' })).toHaveAttribute(
      'href',
      '/desktop/knowledge-base?search=printer',
    )
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/studenthub/knowledge_base/search?query=printer&limit=6', expect.anything())
    expect(view.emitted('update:count')?.at(-1)).toEqual([6])
  })

  it('does not search for people without Knowledge Base access', async () => {
    mockPermissions(['ticket.agent'])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const view = renderComponent(StudenthubQuickSearchKnowledgeBase, {
      props: { search: 'printer' },
      router: true,
      store: true,
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(view.queryByRole('link')).not.toBeInTheDocument()
  })
})
