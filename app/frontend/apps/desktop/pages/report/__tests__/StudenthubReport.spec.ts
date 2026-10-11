// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import { setCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import { currentPeriod, periodLabel, stepPeriod } from '../utils/studenthubReport.ts'
import Report from '../views/Report.vue'

const config = {
  profiles: [
    { id: 2, name: 'All closed tickets' },
    { id: 5, name: 'LSST Stratford' },
    { id: 7, name: 'FSB Sheffield' },
    { id: 8, name: 'FSB Croydon' },
    { id: 9, name: 'UKBC Leicester' },
    { id: 10, name: 'MEMO House' },
  ],
  config: {
    metric: {
      count: {
        name: 'count',
        display: 'Ticket Count',
        prio: 10000,
        default: true,
        backend: [
          { name: 'count::created', display: 'Created', selected: true, dataDownload: true },
          { name: 'count::closed', display: 'Closed', selected: true, dataDownload: true },
          { name: 'count::reopened', display: 'Reopened', selected: false, dataDownload: true },
        ],
      },
      create_channels: {
        name: 'create_channels',
        display: 'Creation Channels',
        prio: 10100,
        backend: [
          {
            name: 'create_channels::email_in',
            display: 'Email (in)',
            selected: true,
            dataDownload: true,
          },
          {
            name: 'create_channels::web_in',
            display: 'Web (in)',
            selected: true,
            dataDownload: true,
          },
          {
            name: 'create_channels::phone_in',
            display: 'Phone (in)',
            selected: true,
            dataDownload: true,
          },
        ],
      },
      communication: {
        name: 'communication',
        display: 'Communication',
        prio: 10200,
        backend: [
          {
            name: 'communication::email_in',
            display: 'Email (in)',
            selected: true,
            dataDownload: false,
          },
          {
            name: 'communication::email_out',
            display: 'Email (out)',
            selected: true,
            dataDownload: false,
          },
        ],
      },
    },
  },
}

const ticket = (id: number, title: string) => ({
  id,
  number: String(886100 + id),
  title,
  campus: 'LSST Stratford',
  state_id: 4,
  created_at: '2026-06-19T09:17:00Z',
})

const sets = (count: number, titles: string[]) => ({
  count,
  ticket_ids: titles.map((_, index) => index + 11),
  assets: {
    Ticket: Object.fromEntries(
      titles.map((title, index) => [index + 11, ticket(index + 11, title)]),
    ),
  },
})

// The selected profile (2) counts 0, 3 and 5 tickets created; every other profile 1 a month.
const generate = (body: any) => {
  if (body.metric === 'create_channels') {
    return {
      data: {
        'create_channels::email_in': [1, 2, 0],
        'create_channels::web_in': [4, 0, 0],
        'create_channels::phone_in': [0, 1, 0],
      },
    }
  }

  const profileId = Number(Object.keys(body.profiles)[0])
  return {
    data: {
      'count::created': profileId === 2 ? [0, 3, 5] : [1, 1, 1],
      'count::closed': [0, 2, 4],
      'count::reopened': [0, 1, 0],
    },
  }
}

type Reply =
  | { status?: number; body: unknown }
  | ((body: any) => { status?: number; body: unknown })

const mockServer = (overrides: Record<string, Reply> = {}) => {
  const calls: { method: string; url: string; body?: any; headers: Record<string, string> }[] = []
  const replies: Record<string, Reply> = {
    'GET /api/v1/ticket_states': { body: [{ id: 4, name: '6. Closed' }] },
    'GET /api/v1/reports/config': { body: config },
    'POST /api/v1/reports/generate': (body) => ({ body: generate(body) }),
    'POST /api/v1/reports/sets': { body: sets(2, ['New laptop', 'MFA reset']) },
    ...overrides,
  }

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET'
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
      calls.push({ method, url, body, headers: (init.headers ?? {}) as Record<string, string> })

      const reply = replies[`${method} ${url}`]
      const answer = typeof reply === 'function' ? reply(body) : reply
      if (!answer)
        return new Response(JSON.stringify({ error: `No mock for ${method} ${url}` }), {
          status: 404,
        })

      return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 })
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

const loaded = async (view: ReturnType<typeof renderPage>, name = 'All closed tickets') =>
  view.findByRole('heading', { level: 1, name })

// The figure tile with this label.
const tile = (view: ReturnType<typeof renderPage>, label: string) =>
  view.getAllByRole('term').find((term) => term.textContent?.trim() === label)?.parentElement

describe('Reporting', () => {
  beforeEach(() => {
    setCSRFToken('token-1')
    sessionStorage.clear()
    mockPermissions(['admin'])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows the profile's figures and the tickets behind them, asking with the CSRF token", async () => {
    const calls = mockServer()
    const view = renderPage()
    await loaded(view)

    expect(tile(view, 'Created')).toHaveTextContent('8')
    expect(tile(view, 'Closed')).toHaveTextContent('6')
    expect(tile(view, 'Closed')).toHaveTextContent('75% of those created')
    expect(tile(view, 'Backlog')).toHaveTextContent('+2')
    expect(tile(view, 'Busiest month')).toHaveTextContent('5 created')

    expect(await view.findByRole('button', { name: 'Created · 8' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(view.getByRole('button', { name: 'Closed · 6' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(view.getByRole('button', { name: 'Reopened · 1' })).toBeInTheDocument()

    const row = (await view.findByText('New laptop')).closest('tr')!
    expect(row).toHaveTextContent('LSST Stratford')
    expect(row).toHaveTextContent('6. Closed')
    expect(within(row).getByRole('link', { name: '#886111' })).toHaveAttribute(
      'href',
      '/tickets/11',
    )
    expect(view.getByText('Showing all 2.')).toBeInTheDocument()

    const generateCall = calls.find(
      (call) =>
        call.url === '/api/v1/reports/generate' &&
        call.body.profiles[2] &&
        call.body.backends['count::closed'],
    )
    expect(generateCall?.headers['X-CSRF-Token']).toBe('token-1')
    expect(generateCall?.body).toMatchObject({
      metric: 'count',
      timeRange: 'year',
      backends: { 'count::created': true, 'count::closed': true, 'count::reopened': true },
    })
    expect(calls.filter((call) => call.url === '/api/v1/reports/sets')).toHaveLength(1)
  })

  it('lists the profiles in one list with their tickets created, and filters them', async () => {
    mockServer()
    const view = renderPage()
    await loaded(view)

    const profiles = within(view.getByRole('group', { name: 'Report profile' }))
    expect(profiles.getAllByRole('radio')).toHaveLength(6)
    expect(profiles.getByRole('radio', { name: /All closed tickets/ })).toBeChecked()
    expect(await profiles.findByText('LSST Stratford')).toBeInTheDocument()
    await vi.waitFor(() =>
      expect(profiles.getByText('All closed tickets').closest('label')).toHaveTextContent(
        '8 tickets created',
      ),
    )
    expect(profiles.getByText('FSB Croydon').closest('label')).toHaveTextContent(
      '3 tickets created',
    )

    await view.events.type(view.getByLabelText('Find a profile'), 'fsb')

    expect(
      profiles.getAllByRole('radio').map((radio) => radio.closest('label')?.textContent),
    ).toEqual([expect.stringContaining('FSB Sheffield'), expect.stringContaining('FSB Croydon')])

    await view.events.clear(view.getByLabelText('Find a profile'))
    await view.events.type(view.getByLabelText('Find a profile'), 'nothing like it')

    expect(profiles.getByText('No profile matches.')).toBeInTheDocument()
  })

  it('shows another profile', async () => {
    const calls = mockServer()
    const view = renderPage()
    await loaded(view)

    await view.events.click(view.getByRole('radio', { name: /LSST Stratford/ }))

    expect(await loaded(view, 'LSST Stratford')).toBeInTheDocument()
    expect(
      calls.some(
        (call) =>
          call.url === '/api/v1/reports/generate' &&
          call.body.profiles[5] &&
          call.body.backends['count::closed'],
      ),
    ).toBe(true)
    await vi.waitFor(() => expect(tile(view, 'Created')).toHaveTextContent('3'))
  })

  it('measures how tickets came in', async () => {
    const calls = mockServer()
    const view = renderPage()
    await loaded(view)

    await view.events.click(view.getByRole('radio', { name: 'How tickets came in' }))

    await vi.waitFor(() => expect(tile(view, 'Total')).toHaveTextContent('8'))
    expect(tile(view, 'Web (in)')).toHaveTextContent('4')
    expect(tile(view, 'Web (in)')).toHaveTextContent('50% of the total')
    expect(view.getByRole('button', { name: 'Email (in) · 3' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(calls.at(-1)?.body).toMatchObject({
      metric: 'create_channels',
      downloadBackendSelected: 'create_channels::email_in',
    })
  })

  it('says that messages have no ticket list', async () => {
    mockServer()
    const view = renderPage()
    await loaded(view)

    await view.events.click(view.getByRole('radio', { name: 'Messages in and out' }))

    expect(
      await view.findByText(
        'This measure counts messages, not tickets, so there is no list of tickets.',
      ),
    ).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Download Excel' })).toBeDisabled()
  })

  it('steps through the periods, but not into the future', async () => {
    const calls = mockServer()
    const view = renderPage()
    await loaded(view)

    expect(view.getByRole('button', { name: 'Next year' })).toBeDisabled()

    await view.events.click(view.getByRole('button', { name: 'Month' }))

    const month = currentPeriod('month')
    expect(view.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
    expect(view.getByText(periodLabel(month))).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Next month' })).toBeDisabled()

    await view.events.click(view.getByRole('button', { name: 'Previous month' }))

    const previous = stepPeriod(month, -1)
    expect(view.getByText(periodLabel(previous))).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Next month' })).toBeEnabled()
    await vi.waitFor(() =>
      expect(
        calls.some(
          (call) =>
            call.url === '/api/v1/reports/generate' &&
            call.body.timeRange === 'month' &&
            call.body.month === previous.month &&
            call.body.year === previous.year,
        ),
      ).toBe(true),
    )
  })

  it('shows more tickets and the tickets of another series', async () => {
    const titles = Array.from({ length: 12 }, (_, index) => `Ticket ${index + 1}`)
    const calls = mockServer({ 'POST /api/v1/reports/sets': { body: sets(40, titles) } })
    const view = renderPage()
    await loaded(view)

    expect(await view.findByText('Ticket 10')).toBeInTheDocument()
    expect(view.queryByText('Ticket 11')).not.toBeInTheDocument()
    expect(
      view.getByText('Showing the 10 most recently updated of 40. Download Excel has them all.'),
    ).toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Show more' }))

    expect(view.getByText('Ticket 12')).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument()

    await view.events.click(view.getByRole('button', { name: 'Closed · 6' }))

    expect(view.getByRole('button', { name: 'Closed · 6' })).toHaveAttribute('aria-pressed', 'true')
    await vi.waitFor(() =>
      expect(calls.at(-1)?.body).toMatchObject({ downloadBackendSelected: 'count::closed' }),
    )
  })

  it('downloads the spreadsheet from Zammad', async () => {
    mockServer()
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    const view = renderPage()
    await loaded(view)
    await view.findByText('New laptop')

    await view.events.click(view.getByRole('button', { name: 'Download Excel' }))

    expect(open).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/api\/v1\/reports\/sets\?sheet=true&.*profile_id=2&downloadBackendSelected=count%3A%3Acreated$/,
      ),
      '_blank',
    )
  })

  it('pauses and resumes the live refresh', async () => {
    mockServer()
    const view = renderPage()
    await loaded(view)

    const live = view.getByRole('button', { name: 'Live' })
    expect(live).toHaveAttribute('aria-pressed', 'true')

    await view.events.click(live)

    expect(live).toHaveAttribute('aria-pressed', 'false')
    expect(JSON.parse(sessionStorage.getItem('report::params') ?? '{}')).toMatchObject({
      live: false,
    })
  })

  it('says that reports need Elasticsearch instead of showing figures', async () => {
    const calls = mockServer({
      'GET /api/v1/reports/config': { body: { error: 'Elasticsearch needs to be configured!' } },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent(
      'Elasticsearch needs to be configured!',
    )
    expect(view.getByRole('alert')).toHaveTextContent(
      'Whoever looks after the server can set it up.',
    )
    expect(view.queryByText('Tickets behind the figures')).not.toBeInTheDocument()
    expect(calls.some((call) => call.url === '/api/v1/reports/generate')).toBe(false)
  })

  it('points to Report Profiles when there are none', async () => {
    mockServer({
      'GET /api/v1/reports/config': {
        body: { error: 'There are currently no report profiles configured.' },
      },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent(
      'There are currently no report profiles configured.',
    )
    expect(
      view.getByRole('link', { name: 'Create one under Administration → Report Profiles.' }),
    ).toHaveAttribute('href', expect.stringContaining('/manage/report_profiles'))
  })

  it('says when Zammad could not make the report', async () => {
    mockServer({
      'POST /api/v1/reports/generate': {
        status: 422,
        body: { error_human: 'Could not find metric count' },
      },
    })
    const view = renderPage()

    expect(await view.findByRole('alert')).toHaveTextContent(
      'The report could not be loaded: Could not find metric count',
    )
  })
})
