// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { renderComponent } from '#tests/support/components/index.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import StudenthubTopBar from '../StudenthubTopBar.vue'

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
