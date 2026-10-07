// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'

import { useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { resetStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import StudenthubKnowledgeBase from '../views/StudenthubKnowledgeBase.vue'

import type { KnowledgeBaseAnswerDetail, KnowledgeBaseTree } from '../types.ts'

const mockWaitForVariantConfirmation = vi.hoisted(() => vi.fn())

vi.mock('#shared/composables/useConfirmation.ts', () => ({
  useConfirmation: () => ({ waitForVariantConfirmation: mockWaitForVariantConfirmation }),
}))

const kbRoute = {
  path: '/knowledge-base/:kind(category|answer)?/:id(\\d+)?/:mode(edit|new)?',
  name: 'StudenthubKnowledgeBase',
  component: { template: '<div />' },
}

const tree = (editable = true): KnowledgeBaseTree => ({
  knowledge_base: {
    id: 3,
    active: true,
    titles: { '4': 'IT Help' },
    locales: [{ id: 4, locale: 'en-us', name: 'English (United States)', primary: true }],
    can_create_category: editable,
  },
  categories: [
    { id: 6, parent_id: null, position: 0, icon: 'f0eb', titles: { '4': 'How-To Guides' }, translation_ids: { '4': 60 }, editable },
    { id: 7, parent_id: 6, position: 0, icon: 'f1eb', titles: { '4': 'Wi-Fi' }, translation_ids: { '4': 70 }, editable },
    { id: 8, parent_id: null, position: 1, icon: 'f128', titles: { '4': 'FAQs' }, translation_ids: { '4': 80 }, editable },
  ],
  answers: [
    { id: 11, category_id: 6, position: 0, promoted: false, state: 'published', titles: { '4': 'Reset your password' }, updated_at: '2026-10-01T10:00:00Z', editable },
    { id: 12, category_id: 7, position: 0, promoted: false, state: 'internal', titles: { '4': 'Eduroam setup' }, updated_at: '2026-10-05T10:00:00Z', editable },
    { id: 13, category_id: 8, position: 0, promoted: false, state: 'draft', titles: { '4': 'Printing on campus' }, updated_at: '2026-09-01T10:00:00Z', editable },
  ],
})

const answer = (state: KnowledgeBaseAnswerDetail['state'] = 'internal', editable = true): KnowledgeBaseAnswerDetail => ({
  id: 12,
  knowledge_base_id: 3,
  category_id: 7,
  state,
  promoted: false,
  editable,
  translations: [
    {
      id: 120,
      kb_locale_id: 4,
      title: 'Eduroam setup',
      content_id: 1200,
      body: '<p>Join <b>eduroam</b> with your student login.</p>',
      updated_at: '2026-10-05T10:00:00Z',
      updated_by: 'Test Agent',
    },
  ],
  attachments: [{ id: 99, filename: 'eduroam.pdf', size: 204800, content_type: 'application/pdf' }],
  tags: ['wifi'],
  internal_at: '2026-10-05T10:00:00Z',
  published_at: null,
  archived_at: null,
  updated_at: '2026-10-05T10:00:00Z',
})

type Reply = { status?: number; body: unknown }

const mockServer = (routes: Record<string, () => Reply>) => {
  const calls: { method: string; url: string; body?: unknown }[] = []
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = init.method ?? 'GET'
    calls.push({ method, url, body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body })
    const handler = routes[`${method} ${url}`]
    const reply = handler ? handler() : { status: 404, body: { error: `No mock for ${method} ${url}` } }
    return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return calls
}

const homeRoute = { path: '/', name: 'Home', component: { template: '<div />' } }

const renderPage = async (path: string) => {
  const view = renderComponent(StudenthubKnowledgeBase, {
    router: true,
    routerRoutes: [homeRoute, kbRoute],
    store: true,
    form: true,
  })
  await view.router.push(path)
  return view
}

describe('Student Hub Knowledge Base page', () => {
  beforeEach(() => {
    useNotifications().clearAllNotifications()
    resetStudenthubKnowledgeBase()
    setCSRFToken('test-token')
    mockWaitForVariantConfirmation.mockResolvedValue(true)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the categories and the answers changed last', async () => {
    mockServer({ 'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }) })

    const view = await renderPage('/knowledge-base')

    expect(await view.findByRole('heading', { level: 1, name: 'IT Help' })).toBeInTheDocument()
    const categories = view.getByRole('navigation', { name: 'Categories' })
    expect(categories).toHaveTextContent('How-To Guides2')
    expect(categories).toHaveTextContent('FAQs1')

    const recent = view.getAllByRole('link', { name: /Eduroam setup|Reset your password|Printing on campus/ })
    expect(recent[0]).toHaveTextContent('Eduroam setup')
  })

  it('shows a category with its sub-categories and answers, and the actions for editors', async () => {
    mockServer({ 'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }) })

    const view = await renderPage('/knowledge-base/category/6')

    expect(await view.findByRole('heading', { level: 1, name: 'How-To Guides' })).toBeInTheDocument()
    const subcategories = view.getByRole('region', { name: 'Sub-categories' })
    expect(within(subcategories).getByRole('link', { name: /Wi-Fi/ })).toHaveAttribute('href', '/desktop/knowledge-base/category/7')
    const answers = view.getByRole('region', { name: 'Answers' })
    expect(within(answers).getByRole('link', { name: /Reset your password/ })).toHaveAttribute('href', '/desktop/knowledge-base/answer/11')
    expect(view.getByRole('button', { name: 'New answer' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    // Not empty, so it can't be deleted.
    expect(view.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows readers no actions', async () => {
    mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree(false) }),
      'GET /api/v1/studenthub/knowledge_base/answers/12': () => ({ body: answer('internal', false) }),
    })

    const view = await renderPage('/knowledge-base/category/6')
    expect(await view.findByRole('heading', { level: 1, name: 'How-To Guides' })).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'New answer' })).not.toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'New category' })).not.toBeInTheDocument()

    await view.router.push('/knowledge-base/answer/12')
    expect(await view.findByRole('article', { name: 'Eduroam setup' })).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(view.queryByText('Add files')).not.toBeInTheDocument()
  })

  it('shows an answer with its text, files and tags, and publishes it', async () => {
    let state: KnowledgeBaseAnswerDetail['state'] = 'internal'
    const calls = mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }),
      'GET /api/v1/studenthub/knowledge_base/answers/12': () => ({ body: answer(state) }),
      'POST /api/v1/knowledge_bases/3/answers/12/publish': () => {
        state = 'published'
        return { body: {} }
      },
    })

    const view = await renderPage('/knowledge-base/answer/12')

    const article = await view.findByRole('article', { name: 'Eduroam setup' })
    expect(article).toHaveTextContent('Join eduroam with your student login.')
    expect(article).toHaveTextContent('Internal')
    expect(view.getByRole('link', { name: 'eduroam.pdf' })).toHaveAttribute('href', '/api/v1/attachments/99?disposition=attachment')
    expect(article).toHaveTextContent('wifi')

    await view.events.click(view.getByRole('button', { name: 'Publish' }))

    await vi.waitFor(() => expect(view.getByRole('article', { name: 'Eduroam setup' })).toHaveTextContent('Public'))
    const publish = calls.find((call) => call.method === 'POST')
    expect(publish?.url).toBe('/api/v1/knowledge_bases/3/answers/12/publish')
    expect(view.getByRole('button', { name: 'Archive' })).toBeInTheDocument()
  })

  it('deletes an answer after asking, and goes back to its category', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }),
      'GET /api/v1/studenthub/knowledge_base/answers/12': () => ({ body: answer() }),
      'DELETE /api/v1/knowledge_bases/3/answers/12': () => ({ body: {} }),
    })

    const view = await renderPage('/knowledge-base/answer/12')
    await view.findByRole('article', { name: 'Eduroam setup' })

    await view.events.click(view.getByRole('button', { name: 'Delete' }))

    expect(mockWaitForVariantConfirmation).toHaveBeenCalledWith('delete')
    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/knowledge-base/category/7'))
    expect(calls.some((call) => call.method === 'DELETE' && call.url === '/api/v1/knowledge_bases/3/answers/12')).toBe(true)
  })

  it('shows the server message when a change is refused', async () => {
    mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }),
      'GET /api/v1/studenthub/knowledge_base/answers/12': () => ({ body: answer() }),
      'POST /api/v1/knowledge_bases/3/answers/12/archive': () => ({ status: 422, body: { error_human: 'Archived date must be no earlier than internal date' } }),
    })

    const view = await renderPage('/knowledge-base/answer/12')
    await view.findByRole('article', { name: 'Eduroam setup' })
    await view.events.click(view.getByRole('button', { name: 'Archive' }))

    const { notifications } = useNotifications()
    await vi.waitFor(() =>
      expect(notifications.value.at(-1)?.message).toBe('Archived date must be no earlier than internal date'),
    )
    expect(view.getByRole('article', { name: 'Eduroam setup' })).toHaveTextContent('Internal')
  })

  it('edits an answer and goes back to it', async () => {
    const calls = mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }),
      'GET /api/v1/studenthub/knowledge_base/answers/12': () => ({ body: answer() }),
      'PATCH /api/v1/knowledge_bases/3/answers/12': () => ({ body: { id: 12 } }),
    })

    const view = await renderPage('/knowledge-base/answer/12/edit')

    const title = await view.findByLabelText('Title')
    expect(title).toHaveValue('Eduroam setup')
    await view.events.clear(title)
    await view.events.type(title, 'Connect to eduroam')
    await view.events.click(view.getByRole('button', { name: 'Save' }))

    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/knowledge-base/answer/12'))
    const update = calls.find((call) => call.method === 'PATCH')
    expect(update?.body).toEqual({
      category_id: 7,
      translations_attributes: [
        {
          id: 120,
          kb_locale_id: 4,
          title: 'Connect to eduroam',
          content_attributes: { body: '<p>Join <b>eduroam</b> with your student login.</p>' },
        },
      ],
    })
  })

  it('filters titles in the side panel', async () => {
    mockServer({ 'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }) })

    const view = await renderPage('/knowledge-base')
    await view.findByRole('navigation', { name: 'Categories' })

    await view.events.type(view.getByPlaceholderText('Filter by title…'), 'print')

    const matches = view.getByRole('navigation', { name: 'Matching titles' })
    expect(matches).toHaveTextContent('Printing on campus')
    expect(matches).not.toHaveTextContent('Eduroam setup')
  })

  it('searches titles and text of the answers', async () => {
    mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: tree() }),
      'GET /api/v1/studenthub/knowledge_base/search?query=student+login&limit=50': () => ({
        body: [
          { id: 12, kb_locale_id: 4, title: 'Eduroam setup', snippet: 'Join eduroam with your student login.', category_id: 7, state: 'internal', updated_at: '2026-10-05T10:00:00Z' },
        ],
      }),
    })

    const view = await renderPage('/knowledge-base')
    await view.findByRole('heading', { level: 1, name: 'IT Help' })

    await view.events.type(view.getByRole('searchbox', { name: 'Search the Knowledge Base' }), 'student login')
    await view.events.click(view.getByRole('button', { name: 'Search' }))

    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/knowledge-base?search=student+login'))
    const results = await view.findByRole('region', { name: 'Answers with “student login”' })
    const result = await within(results).findByRole('link', { name: /Eduroam setup/ })
    expect(result).toHaveTextContent('How-To Guides › Wi-Fi')
    expect(result).toHaveTextContent('Join eduroam with your student login.')
    expect(result).toHaveAttribute('href', '/desktop/knowledge-base/answer/12')
  })

  it('says when there is no Knowledge Base', async () => {
    mockServer({
      'GET /api/v1/studenthub/knowledge_base': () => ({ body: { knowledge_base: null, categories: [], answers: [] } }),
    })

    const view = await renderPage('/knowledge-base')

    expect(await view.findByText(/There is no Knowledge Base yet/)).toBeInTheDocument()
  })
})
