// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import Report from '../views/Report.vue'

const config = {
  profiles: [
    { id: 2, name: 'All closed tickets' },
    { id: 5, name: 'LSST Stratford' },
  ],
  config: {
    metric: {
      count: {
        name: 'count',
        display: 'Ticket Count',
        default: true,
        backend: [
          { name: 'count::created', display: 'Created', selected: true, dataDownload: true },
          { name: 'count::closed', display: 'Closed', selected: true, dataDownload: true },
          { name: 'count::reopened', display: 'Reopened', selected: false, dataDownload: true },
        ],
      },
    },
  },
}

const sets = {
  count: 2,
  ticket_ids: [11, 12],
  assets: {
    Ticket: {
      11: { id: 11, number: '886138', title: 'New laptop', customer_id: 7, state_id: 4, created_at: '2026-06-19T09:17:00Z' },
      12: { id: 12, number: '886137', title: 'MFA reset', customer_id: 7, state_id: 4, created_at: '2026-06-18T15:53:00Z' },
    },
    User: { 7: { firstname: 'Nicole', lastname: 'Braun' } },
  },
}

const mockServer = (overrides: Record<string, { status?: number; body: unknown }> = {}) => {
  const calls: { method: string; url: string; body?: any; headers: Record<string, string> }[] = []
  const replies: Record<string, { status?: number; body: unknown }> = {
    'GET /api/v1/ticket_states': { body: [{ id: 4, name: '6. Closed' }] },
    'GET /api/v1/reports/config': { body: config },
    'POST /api/v1/reports/generate': { body: { data: { 'count::created': [0, 3, 5], 'count::closed': [0, 2, 4] } } },
    'POST /api/v1/reports/sets': { body: sets },
    ...overrides,
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ method, url, body, headers: (init.headers ?? {}) as Record<string, string> })

      const reply = replies[`${method} ${url}`] ?? { status: 404, body: { error: `No mock for ${method} ${url}` } }
      return new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 })
    }),
  )

  return calls
}

const renderPage = () =>
  renderComponent(Report, {
    router: true,
    store: true,
    global: { stubs: { LayoutContent: { template: '<div><slot /></div>' } } },
  })

describe('Reporting', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    sessionStorage.clear()
    mockPermissions(['admin'])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows Zammad's figures and tickets, asking with the CSRF token", async () => {
    const calls = mockServer()
    const view = renderPage()

    expect(await view.findByText('2 records')).toBeInTheDocument()
    expect(view.getByRole('button', { name: /Created\s*8/ })).toBeInTheDocument()
    expect(view.getByRole('button', { name: /Closed\s*6/ })).toBeInTheDocument()
    expect(view.getByText('New laptop').closest('tr')).toHaveTextContent('Nicole Braun')
    expect(view.getByText('New laptop').closest('tr')).toHaveTextContent('6. Closed')
    expect(view.getByRole('button', { name: /Download 2 record\(s\)/ })).toBeEnabled()

    const generate = calls.find((call) => call.url === '/api/v1/reports/generate')
    expect(generate?.headers['X-CSRF-Token']).toBe('token-1')
    expect(generate?.body).toMatchObject({ metric: 'count', profiles: { 2: true }, backends: { 'count::created': true } })
    expect(calls.filter((call) => call.url === '/api/v1/reports/sets')).toHaveLength(1)
    expect(calls.some((call) => call.url.includes('analytics'))).toBe(false)
  })

  it('downloads the spreadsheet from Zammad', async () => {
    mockServer()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const view = renderPage()

    await view.events.click(await view.findByRole('button', { name: /Download 2 record\(s\)/ }))

    expect(open).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/v1\/reports\/sets\?sheet=true&.*profile_id=2/), '_blank')
  })

  it('says that reports need Elasticsearch instead of showing figures', async () => {
    const calls = mockServer({
      'GET /api/v1/reports/config': { body: { error: 'Elasticsearch needs to be configured!' } },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent('Elasticsearch needs to be configured!')
    expect(view.getByRole('alert')).toHaveTextContent('Whoever looks after the server can set it up.')
    expect(view.queryByText('Dataset Inspection & Tickets')).not.toBeInTheDocument()
    expect(calls.some((call) => call.url === '/api/v1/reports/generate')).toBe(false)
  })

  it('points to Report Profiles when there are none', async () => {
    mockServer({
      'GET /api/v1/reports/config': { body: { error: 'There are currently no report profiles configured.' } },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent('There are currently no report profiles configured.')
    expect(view.getByRole('link', { name: 'Create one under Administration → Report Profiles.' })).toHaveAttribute(
      'href',
      expect.stringContaining('/manage/report_profiles'),
    )
  })

  it('says when Zammad could not make the report', async () => {
    mockServer({
      'POST /api/v1/reports/generate': { status: 422, body: { error_human: 'Could not find metric count' } },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent('The report could not be loaded: Could not find metric count')
  })
})
