// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { visitView } from '#tests/support/components/visitView.ts'
import { mockGraphQLApi, mockGraphQLSubscription } from '#tests/support/mock-graphql-api.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { waitUntil } from '#tests/support/utils.ts'

import { mockOnlineNotificationQuery } from '#shared/entities/online-notification/__tests__/mocks/online-notification-mocks.ts'
import { OnlineNotificationsDocument } from '#shared/entities/online-notification/graphql/queries/onlineNotifications.api.ts'
import { OnlineNotificationsCountDocument } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.api.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

const ticket = (internalId: number, title: string) => ({
  __typename: 'Ticket' as const,
  id: convertToGraphQLId('Ticket', internalId),
  internalId,
  title,
})

const visitNotifications = async (
  notifications: Parameters<typeof mockOnlineNotificationQuery>[0],
  unseenCount = 0,
) => {
  const notificationsMock = mockGraphQLApi(OnlineNotificationsDocument).willResolve(
    mockOnlineNotificationQuery(notifications),
  )
  const count = mockGraphQLSubscription(OnlineNotificationsCountDocument)

  const view = await visitView('/notifications')
  await count.next({
    data: {
      onlineNotificationsCount: { __typename: 'OnlineNotificationsCountPayload', unseenCount },
    },
  })
  await waitUntil(() => notificationsMock.calls.resolve)

  return view
}

// Student Hub: the students' notifications page.
describe('Student Hub notifications', () => {
  beforeEach(() => {
    mockUserCurrent({ firstname: 'Jane', lastname: 'Student' })
  })

  it('tells the student of replies and where their tickets stand, each opening its ticket', async () => {
    const view = await visitNotifications(
      [
        {
          typeName: 'studenthub_reply',
          createdBy: {
            id: convertToGraphQLId('User', 2),
            fullname: 'Sara Smith',
            firstname: 'Sara',
            lastname: 'Smith',
          },
          metaObject: ticket(111, 'New ID Card'),
        },
        { typeName: 'studenthub_progress', metaObject: ticket(112, 'Moodle login') },
        { typeName: 'studenthub_waiting', metaObject: ticket(113, 'Wi-Fi password') },
        { typeName: 'studenthub_resolved', seen: true, metaObject: ticket(114, 'Library card') },
        { typeName: 'studenthub_closed', seen: true, metaObject: ticket(115, 'Laptop charger') },
      ],
      3,
    )

    const reply = view.getByText('replied to', { exact: false })
    expect(reply).toHaveTextContent('The team replied to New ID Card')
    expect(view.getLinkFromElement(reply)).toHaveAttribute('href', '/mobile/tickets/111')

    expect(view.getByText(/Moodle login/).parentElement).toHaveTextContent(
      'Your ticket Moodle login is in progress',
    )
    expect(view.getByText(/Wi-Fi password/).parentElement).toHaveTextContent(
      'Your ticket Wi-Fi password is waiting for your reply',
    )
    expect(view.getByText(/Library card/).parentElement).toHaveTextContent(
      'Your ticket Library card was resolved',
    )
    expect(view.getByText(/Laptop charger/).parentElement).toHaveTextContent(
      'Your ticket Laptop charger was closed',
    )
    expect(view.getByIconName('clock')).toBeInTheDocument()
    expect(view.getByIconName('check-double')).toBeInTheDocument()
  })

  // Deleting and marking all read: Zammad's online-notification-actions spec.
  it('has the app header with the unread count, and labelled buttons to mark all read and delete', async () => {
    const view = await visitNotifications([{ seen: false }, { seen: false }], 2)

    expect(view.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
    expect(view.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/mobile/')
    expect(view.getByText('2 unread')).toBeInTheDocument()
    expect(view.getByRole('button', { name: 'Mark all as read' })).toBeEnabled()
    expect(view.getAllByRole('button', { name: 'Delete notification' })).toHaveLength(2)
  })

  it('shows the title of a ticket as text', async () => {
    const view = await visitNotifications([
      { typeName: 'studenthub_closed', metaObject: ticket(116, '<img src=x onerror=alert(1)>') },
    ])

    expect(view.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
    expect(view.container.querySelector('img[src="x"]')).toBeNull()
  })

  it('says so when there are none', async () => {
    const view = await visitNotifications([])

    expect(view.getByText('You have no notifications.')).toBeInTheDocument()
    expect(view.queryByRole('button', { name: 'Mark all as read' })).not.toBeInTheDocument()
  })
})
