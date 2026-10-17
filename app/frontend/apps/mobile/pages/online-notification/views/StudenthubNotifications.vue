<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref } from 'vue'

import { useOnlineNotificationActions } from '#shared/entities/online-notification/composables/useOnlineNotificationActions.ts'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useOnlineNotificationList } from '#shared/entities/online-notification/composables/useOnlineNotificationList.ts'

import CommonLoader from '#mobile/components/CommonLoader/CommonLoader.vue'
import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'

import StudenthubNotificationItem from '../components/StudenthubNotificationItem.vue'

// Student Hub: the students' notifications in the style of Home and the Tickets tab (design C1):
// staff replies and where their tickets stand (Transaction::StudenthubStudentNotification).
// Opening a ticket marks its notifications read.

const { notificationList, loading, refetch } = useOnlineNotificationList()
const { markAllRead } = useOnlineNotificationActions()
const { unseenCount, notificationsCountSubscription } = useOnlineNotificationCount()

// New notifications arrive through the count.
notificationsCountSubscription.watchOnResult(() => refetch())

const markingAllRead = ref(false)

const runMarkAllRead = async () => {
  markingAllRead.value = true
  await markAllRead(notificationList.value.filter(({ seen }) => !seen).map(({ id }) => id))
  markingAllRead.value = false
}
</script>

<template>
  <div>
    <StudenthubAppHeader
      :title="$t('Notifications')"
      back-link="/"
      :back-label="$t('Back to Home')"
    >
      <div v-if="unseenCount" class="flex items-center justify-between gap-3">
        <p class="text-sm text-white/85">{{ $t('%s unread', unseenCount) }}</p>
        <button
          type="button"
          class="h-9 rounded-full bg-white/15 px-4 text-sm font-semibold disabled:opacity-50"
          :disabled="markingAllRead"
          @click="runMarkAllRead"
        >
          {{ $t('Mark all as read') }}
        </button>
      </div>
    </StudenthubAppHeader>
    <div class="-mt-7 px-5 pb-5">
      <CommonLoader :loading="loading">
        <ul v-if="notificationList.length" class="flex flex-col gap-2.5">
          <StudenthubNotificationItem
            v-for="notification in notificationList"
            :key="notification.id"
            :notification="notification"
          />
        </ul>
        <div
          v-else
          class="flex flex-col items-center gap-2 rounded-2xl bg-gray-500 px-4 py-8 text-center"
        >
          <span
            class="flex size-12 items-center justify-center rounded-full bg-blue-highlight text-blue"
          >
            <CommonIcon name="notification-subscribed" decorative />
          </span>
          <p class="text-base font-semibold">{{ $t('You have no notifications.') }}</p>
          <p class="text-sm text-gray">
            {{ $t('Replies to your tickets and changes to them show here.') }}
          </p>
        </div>
      </CommonLoader>
    </div>
  </div>
</template>
