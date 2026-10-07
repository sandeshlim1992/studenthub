// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { within } from '@testing-library/vue'

import renderComponent from '#tests/support/components/renderComponent.ts'
import { mockUserCurrent } from '#tests/support/mock-userCurrent.ts'
import { waitForNextTick } from '#tests/support/utils.ts'

import { waitForOnlineNotificationDeleteMutationCalls } from '#shared/entities/online-notification/graphql/mutations/delete.mocks.ts'
import { waitForOnlineNotificationMarkAllAsSeenMutationCalls } from '#shared/entities/online-notification/graphql/mutations/markAllAsSeen.mocks.ts'
import { mockOnlineNotificationsQuery } from '#shared/entities/online-notification/graphql/queries/onlineNotifications.mocks.ts'
import { getOnlineNotificationsCountSubscriptionHandler } from '#shared/entities/online-notification/graphql/subscriptions/onlineNotificationsCount.mocks.ts'
import { convertToGraphQLId } from '#shared/graphql/utils.ts'

import OnlineNotification from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification.vue'

const playSoundSpy = vi.hoisted(() => vi.fn())

const node = {
  id: convertToGraphQLId('OnlineNotification', 1),
  seen: false,
  createdAt: '2024-11-18T16:28:07Z',
  createdBy: {
    id: convertToGraphQLId('User', 1),
    fullname: 'Admin Foo',
    lastname: 'Foo',
    firstname: 'Admin',
    email: 'foo@admin.com',
    vip: false,
    outOfOffice: false,
    outOfOfficeStartAt: null,
    outOfOfficeEndAt: null,
    active: true,
    image: null,
  },
  typeName: 'update',
  objectName: 'Ticket',
  metaObject: {
    id: convertToGraphQLId('Ticket', 1),
    internalId: 1,
    title: 'Bunch of articles',
  },
}
vi.mock('#shared/composables/useOnlineNotification/useOnlineNotificationSound.ts', () => ({
  useOnlineNotificationSound: () => ({
    play: playSoundSpy,
    isEnabled: { value: true },
  }),
}))

describe('OnlineNotification', () => {
  beforeEach(() => {
    mockUserCurrent({
      preferences: {
        notification_sound: {
          enabled: true,
          notification_sound: 'Xylo.mp3',
        },
      },
    })
  })

  it('displays notification logo without unseen notifications', async () => {
    const wrapper = renderComponent(OnlineNotification, {
      props: { collapsed: false },
      slots: {
        default: '<CommonIcon name="logo" />',
      },
      router: true,
    })

    await getOnlineNotificationsCountSubscriptionHandler().trigger({
      onlineNotificationsCount: {
        unseenCount: 0,
      },
    })

    expect(wrapper.getByRole('button', { name: 'Show notifications' })).toBeInTheDocument()

    expect(wrapper.getByIconName('logo')).toBeInTheDocument()

    expect(
      wrapper.queryByRole('status', { name: 'Unseen notifications count' }),
    ).not.toBeInTheDocument()
  })

  it('displays unseen notifications count', async () => {
    const wrapper = renderComponent(OnlineNotification)

    await getOnlineNotificationsCountSubscriptionHandler().trigger({
      onlineNotificationsCount: {
        unseenCount: 10,
      },
    })

    expect(wrapper.getByRole('status', { name: 'Unseen notifications count' })).toHaveTextContent(
      '10',
    )
  })

  // Student Hub: notifications stay inside the platform and are silent.
  it('stays silent and inside the platform when a new notification comes in', async () => {
    const requestPermissionSpy = vi.fn(() => Promise.resolve('granted'))
    const NotificationSpy = vi.fn()

    Object.assign(window.Notification, {
      permission: 'granted',
      requestPermission: requestPermissionSpy,
    })
    vi.stubGlobal('Notification', Object.assign(NotificationSpy, window.Notification))

    const wrapper = renderComponent(OnlineNotification, { router: true })

    await getOnlineNotificationsCountSubscriptionHandler().trigger({
      onlineNotificationsCount: { unseenCount: 0 },
    })
    await getOnlineNotificationsCountSubscriptionHandler().trigger({
      onlineNotificationsCount: { unseenCount: 1 },
    })
    await waitForNextTick()

    expect(wrapper.getByRole('status', { name: 'Unseen notifications count' })).toHaveTextContent('1')
    expect(playSoundSpy).not.toHaveBeenCalled()
    expect(requestPermissionSpy).not.toHaveBeenCalled()
    expect(NotificationSpy).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it('marks all notifications as read.', async () => {
    mockOnlineNotificationsQuery({
      onlineNotifications: {
        edges: [
          {
            node,
          },
        ],
        pageInfo: {
          endCursor: 'Nw',
          hasNextPage: false,
        },
      },
    })

    const wrapper = renderComponent(OnlineNotification, {
      router: true,
    })

    await wrapper.events.click(wrapper.getByRole('button', { name: 'Show notifications' }))

    await wrapper.events.click(await wrapper.findByRole('button', { name: 'mark all as read' }))

    const calls = await waitForOnlineNotificationMarkAllAsSeenMutationCalls()

    expect(calls.at(-1)?.variables).toEqual({
      onlineNotificationIds: [node.id],
    })
  })

  it('removes a notification', async () => {
    mockOnlineNotificationsQuery({
      onlineNotifications: {
        edges: [
          {
            node,
          },
        ],
        pageInfo: {
          endCursor: 'Nw',
          hasNextPage: false,
        },
      },
    })

    const wrapper = renderComponent(OnlineNotification, {
      router: true,
    })

    await wrapper.events.click(wrapper.getByRole('button', { name: 'Show notifications' }))

    const list = await wrapper.findByRole('list')

    await wrapper.events.click(await within(list).findByRole('button'))

    const calls = await waitForOnlineNotificationDeleteMutationCalls()

    expect(calls.at(-1)?.variables).toEqual({
      onlineNotificationId: node.id,
    })
  })
})
