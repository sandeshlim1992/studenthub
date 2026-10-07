<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useOnlineNotificationActions } from '#shared/entities/online-notification/composables/useOnlineNotificationActions.ts'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useOnlineNotificationList } from '#shared/entities/online-notification/composables/useOnlineNotificationList.ts'
import type { OnlineNotification } from '#shared/graphql/types.ts'

import CommonPopover from '#desktop/components/CommonPopover/CommonPopover.vue'
import { usePopover } from '#desktop/components/CommonPopover/usePopover.ts'
import NotificationButton from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification/NotificationButton.vue'
import NotificationPopover from '#desktop/components/layout/LayoutSidebar/LeftSidebar/LeftSidebarHeader/OnlineNotification/NotificationPopover.vue'

// Student Hub: notifications stay inside the platform and are silent: the count on the bell and
// the list (and the dashboard's Activity Stream) update, but there is no browser pop-up, no
// request for browser permission and no sound.

const { unseenCount, notificationsCountSubscription } = useOnlineNotificationCount()

const { popover, popoverTarget, toggle, close } = usePopover()

const {
  notificationList,
  loading: isLoading,
  hasUnseenNotification,
  refetch,
} = useOnlineNotificationList()

const { markAllRead, deleteNotification, seenNotification } = useOnlineNotificationActions()

let mutationTriggered = false

const runMarkAsSeen = async (notification: OnlineNotification) => {
  if (notification.seen) return

  mutationTriggered = true

  await seenNotification(notification.id)

  mutationTriggered = false
}

const removeNotification = async (notification: OnlineNotification) =>
  deleteNotification(notification.id)

const runMarkAllRead = async () => {
  mutationTriggered = true

  const ids = notificationList.value.map((notification) => notification.id)

  await markAllRead(ids)

  mutationTriggered = false
}

// Keep the list in step with the count (new notifications arrive through the count subscription).
notificationsCountSubscription.watchOnResult(() => {
  if (mutationTriggered) return

  refetch()
})

const truncatedUnseenCount = computed(() =>
  unseenCount.value && unseenCount.value > 99 ? '99+' : unseenCount.value,
)

defineOptions({
  inheritAttrs: false,
})
</script>

<template>
  <div class="relative">
    <NotificationButton
      id="app-online-notification"
      ref="popoverTarget"
      v-bind="$attrs"
      @show="toggle(true)"
    >
      <slot />
    </NotificationButton>

    <CommonLabel
      v-if="unseenCount && unseenCount > 0"
      size="xs"
      class="pointer-events-none absolute -bottom-0.75 z-20 block rounded-full border-2 border-white bg-pink-500 px-1 py-0.5 text-center font-bold text-white! ltr:left-[54%] rtl:right-[54%] dark:border-gray-500"
      :aria-label="$t('Unseen notifications count')"
      role="status"
    >
      {{ truncatedUnseenCount }}
    </CommonLabel>

    <CommonPopover ref="popover" z-index="53" orientation="right" :owner="popoverTarget">
      <NotificationPopover
        :unseen-count="unseenCount"
        :loading="isLoading"
        :has-unseen-notification="hasUnseenNotification"
        :notification-list="notificationList"
        @visited="close"
        @seen="runMarkAsSeen"
        @remove="removeNotification"
        @seen-all="runMarkAllRead"
      />
    </CommonPopover>
  </div>
</template>
