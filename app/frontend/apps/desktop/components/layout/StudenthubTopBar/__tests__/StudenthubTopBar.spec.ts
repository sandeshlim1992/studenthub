// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import StudenthubTopBar from '../StudenthubTopBar.vue'
import {
  clearStudenthubTopBarCrumbs,
  setStudenthubTopBarCrumbs,
} from '../useStudenthubTopBarCrumbs.ts'

import '#tests/graphql/builders/mocks.ts'

vi.mock('#shared/server/apollo/client.ts', () => ({
  getApolloClient: () => ({
    cache: {
      readQuery: vi.fn(),
      writeQuery: vi.fn(),
    },
  }),
}))

const cannotCreateTickets = ref(false)
const isManagerOnly = ref(false)

vi.mock('#desktop/composables/useStudenthubApprovalViewer.ts', () => ({
  useStudenthubApprovalViewer: () => ({
    isLoaded: computed(() => true),
    isManagerOnly: computed(() => isManagerOnly.value),
    cannotCreateTickets: computed(() => cannotCreateTickets.value),
  }),
}))

const renderTopBar = (permissions: string[] = ['ticket.agent']) => {
  mockPermissions(permissions)

  return renderComponent(StudenthubTopBar, { router: true, store: true })
}

describe('StudenthubTopBar', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ members: [] }) }),
    )
  })

  afterEach(() => {
    setStudenthubTopBarCrumbs([])
    vi.unstubAllGlobals()
  })

  it('shows where the user is next to the search', async () => {
    setStudenthubTopBarCrumbs([
      { label: 'Tickets', route: '/tickets/view' },
      { label: 'My ALL Tickets' },
    ])

    const view = renderTopBar()
    const crumbs = view.getByRole('navigation', { name: 'Current page' })

    expect(crumbs).toHaveTextContent('Tickets/My ALL Tickets')
    expect(view.getByRole('link', { name: 'Tickets' })).toHaveAttribute(
      'href',
      expect.stringContaining('/tickets/view'),
    )
    expect(view.getByText('My ALL Tickets')).toHaveAttribute('aria-current', 'page')
  })

  it("keeps the next page's crumbs when the previous page is left", async () => {
    const listPage = Symbol('list')
    const ticketPage = Symbol('ticket')

    setStudenthubTopBarCrumbs(
      [{ label: 'Tickets', route: '/tickets/view' }, { label: 'Service Desk' }],
      listPage,
    )
    setStudenthubTopBarCrumbs(
      [
        { label: 'Tickets', route: '/tickets/view' },
        { label: 'Service Desk' },
        { label: 'Ticket#884456' },
      ],
      ticketPage,
    )
    clearStudenthubTopBarCrumbs(listPage)

    const view = renderTopBar()

    expect(view.getByRole('navigation', { name: 'Current page' })).toHaveTextContent(
      'Tickets/Service Desk/Ticket#884456',
    )

    clearStudenthubTopBarCrumbs(ticketPage)
    await waitForNextTick()

    expect(view.queryByRole('navigation', { name: 'Current page' })).not.toBeInTheDocument()
  })

  it('gives agents search, New ticket, notifications and their avatar menu', () => {
    const view = renderTopBar()

    expect(view.getByRole('searchbox')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'New ticket' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Show notifications' })).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'User menu' })).toBeInTheDocument()
  })

  it('leaves Administration and Reporting to the navigation panel', () => {
    const view = renderTopBar(['ticket.agent', 'admin.*', 'report'])

    expect(view.queryByLabelText('Administration')).not.toBeInTheDocument()
    expect(view.queryByLabelText('Reporting')).not.toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Action menu button' })).not.toBeInTheDocument()
  })

  it('opens ticket creation from New ticket', async () => {
    const view = renderTopBar()

    await view.events.click(view.getByRole('button', { name: 'New ticket' }))

    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/tickets/create'))
  })

  it('shows no New ticket to managers who may not raise tickets (not also customers)', () => {
    cannotCreateTickets.value = true

    const view = renderTopBar(['ticket.agent', 'ticket.approver'])

    expect(view.queryByRole('button', { name: 'New ticket' })).not.toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Show notifications' })).toBeInTheDocument()

    cannotCreateTickets.value = false
  })

  it('shows the members online to agents and admins, not to managers without another staff role', async () => {
    const view = renderTopBar()

    expect(await view.findByRole('button', { name: 'Members online: 0' })).toBeInTheDocument()
    view.unmount()

    isManagerOnly.value = true
    const managerView = renderTopBar(['ticket.agent', 'ticket.approver'])

    expect(managerView.queryByRole('button', { name: /Members online/ })).not.toBeInTheDocument()

    isManagerOnly.value = false
  })

  it('shows no New ticket or notifications without the agent permission', () => {
    const view = renderTopBar([])

    expect(view.queryByRole('button', { name: 'New ticket' })).not.toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Show notifications' })).not.toBeInTheDocument()
  })

  it('opens the quick search results under the search field and closes them with Escape', async () => {
    const view = renderTopBar()

    view.getByRole('searchbox').focus()
    await waitForNextTick()

    expect(view.container.querySelector('[data-theme="dark"]')).toBeInTheDocument()

    await view.events.keyboard('{Escape}')

    expect(view.container.querySelector('[data-theme="dark"]')).not.toBeInTheDocument()
  })
})
