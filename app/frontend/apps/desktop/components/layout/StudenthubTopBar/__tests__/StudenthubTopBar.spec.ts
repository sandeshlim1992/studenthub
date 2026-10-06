// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

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

const renderTopBar = (permissions: string[] = ['ticket.agent']) => {
  mockPermissions(permissions)

  return renderComponent(StudenthubTopBar, { router: true, store: true })
}

describe('StudenthubTopBar', () => {
  afterEach(() => setStudenthubTopBarCrumbs([]))

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

  it('opens ticket creation from New ticket', async () => {
    const view = renderTopBar()

    await view.events.click(view.getByRole('button', { name: 'New ticket' }))

    await vi.waitFor(() => expect(view.router.currentRoute.value.fullPath).toBe('/tickets/create'))
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
