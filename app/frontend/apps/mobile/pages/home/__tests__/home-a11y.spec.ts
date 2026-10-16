// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { mockTicketOverviews } from '#tests/support/mocks/ticket-overviews.ts'

import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'

describe('testing home a11y', () => {
  beforeEach(() => {
    mockUserCurrent({ id: '666' })
    mockTicketOverviews()
    // Student Hub: Home's header counts the unread notifications.
    mockGraphQLSubscription(OnlineNotificationsCountDocument)
  })

  it('home screen has no accessibility violations', async () => {
    const view = await visitView('/')
    await expect(view.container).toBeAccessible()
  })

  it('favorite ticket overviews screen has no accessibility violations', async () => {
    const view = await visitView('/favorite/ticket-overviews/edit')
    await expect(view.container).toBeAccessible()
  })
})
