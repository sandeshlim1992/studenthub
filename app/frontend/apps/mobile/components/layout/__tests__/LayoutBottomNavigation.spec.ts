// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { flushPromises } from '@vue/test-utils'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockPermissions } from '#tests/support/mock-permissions.ts'

import LayoutBottomNavigation from '../LayoutBottomNavigation.vue'

const renderNavigation = async () => {
  const view = renderComponent(LayoutBottomNavigation, {
    store: true,
    router: true,
  })
  await flushPromises()

  return view
}

// Student Hub: design C1, Home, New request and Tickets.
describe('bottom navigation in layout', () => {
  it('renders navigation', async () => {
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: true })

    const view = await renderNavigation()

    expect(view.getByIconName('home').closest('a')).toHaveClass('text-blue')
    expect(view.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/mobile/')
    expect(view.getByRole('link', { name: 'New request' })).toHaveAttribute(
      'href',
      '/tickets/create',
    )
    expect(view.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets')
  })

  it("opens staff's overviews from Tickets", async () => {
    mockPermissions(['ticket.agent'])

    const view = await renderNavigation()

    expect(view.getByRole('link', { name: 'Tickets' })).toHaveAttribute('href', '/tickets/view')
  })

  it('leaves out New request when students may not raise tickets', async () => {
    mockPermissions(['ticket.customer'])
    mockApplicationConfig({ customer_ticket_create: false })

    const view = await renderNavigation()

    expect(view.queryByRole('link', { name: 'New request' })).not.toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Tickets' })).toBeInTheDocument()
  })
})
