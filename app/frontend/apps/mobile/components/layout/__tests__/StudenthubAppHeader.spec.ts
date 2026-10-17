// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { flushPromises } from '@vue/test-utils'

import { renderComponent } from '#tests/support/components/index.ts'
import { mockApplicationConfig } from '#tests/support/mock-applicationConfig.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import type { UserData } from '#shared/types/store.ts'

import StudenthubAppHeader from '../StudenthubAppHeader.vue'

const renderHeader = async (props: Record<string, string> = { title: 'Your tickets' }) => {
  mockApplicationConfig({ product_name: 'Student Hub' })
  const subscription = mockGraphQLSubscription(OnlineNotificationsCountDocument)
  const view = renderComponent(StudenthubAppHeader, {
    props,
    store: true,
    router: true,
  })

  useSessionStore().user = {
    id: convertToGraphQLId('User', 100),
    firstname: 'User',
    lastname: 'Test',
  } as UserData
  await flushPromises()

  return { view, subscription }
}

// Student Hub: the header of Home and the Tickets tab.
describe('Student Hub app header', () => {
  it('shows the title and links to the notifications and the account', async () => {
    const { view } = await renderHeader()

    expect(view.getByRole('heading', { name: 'Your tickets' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Notifications' })).toHaveAttribute(
      'href',
      '/notifications',
    )
    expect(view.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
    expect(view.getByText('UT')).toBeInTheDocument()
    expect(view.getByText('Student Hub')).toBeInTheDocument()
  })

  it('has a back button in place of the product name on pages below Home', async () => {
    const { view } = await renderHeader({
      title: 'Wi-Fi & devices',
      context: 'Help articles › IT & accounts',
      backLink: '/knowledge-base/7',
      backLabel: 'Back to IT & accounts',
    })

    expect(view.getByRole('link', { name: 'Back to IT & accounts' })).toHaveAttribute(
      'href',
      '/knowledge-base/7',
    )
    expect(view.getByText('Help articles › IT & accounts')).toBeInTheDocument()
    expect(view.queryByText('Student Hub')).not.toBeInTheDocument()
  })

  it('counts the unread notifications', async () => {
    const { view, subscription } = await renderHeader()

    expect(view.queryByRole('status', { name: 'Unread notifications' })).not.toBeInTheDocument()

    await subscription.next({ data: { onlineNotificationsCount: { unseenCount: 1 } } })

    expect(view.getByRole('status', { name: 'Unread notifications' })).toHaveTextContent('1')

    await subscription.next({ data: { onlineNotificationsCount: { unseenCount: 120 } } })

    expect(view.getByRole('status', { name: 'Unread notifications' })).toHaveTextContent('99+')
  })
})
