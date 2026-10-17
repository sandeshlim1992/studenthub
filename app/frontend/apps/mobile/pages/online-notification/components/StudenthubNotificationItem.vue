<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import CommonAvatar from '#shared/components/CommonAvatar/CommonAvatar.vue'
import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useActivityMessage } from '#shared/composables/activity-message/useActivityMessage.ts'
import { useOnlineNotificationActions } from '#shared/entities/online-notification/composables/useOnlineNotificationActions.ts'
import type { OnlineNotification } from '#shared/graphql/types.ts'

// Student Hub: one notification as a card: who wrote or where the ticket stands now, what
// happened, when, and whether it is read. It opens its ticket; one about something the student can
// no longer see is marked read by tapping it.

const props = defineProps<{
  notification: OnlineNotification
}>()

// Where the ticket stands, in the colours of the Tickets tab's chips (StudenthubTicketItem.vue).
const stageIcons: Record<string, { name: string; class: string }> = {
  studenthub_progress: { name: 'clock', class: 'bg-blue-highlight text-blue' },
  studenthub_waiting: { name: 'chat', class: 'bg-yellow-highlight text-yellow' },
  studenthub_resolved: { name: 'check-circle-outline', class: 'bg-green-highlight text-green' },
  studenthub_closed: { name: 'check-double', class: 'bg-green-highlight text-green' },
}

const stageIcon = computed(() => stageIcons[props.notification.typeName])

const { link, highlightedMessage } = useActivityMessage(toRef(props, 'notification'))

const { seenNotification, deleteNotification, deleteNotificationMutation } =
  useOnlineNotificationActions()
const deleting = deleteNotificationMutation.loading()

const markSeen = () => {
  if (link || props.notification.seen) return

  seenNotification(props.notification.id)
}
</script>

<template>
  <li
    class="flex items-center gap-3 rounded-2xl bg-gray-500 py-3 ltr:pr-1 ltr:pl-4 rtl:pr-4 rtl:pl-1"
  >
    <span
      v-if="stageIcon"
      class="flex size-10 shrink-0 items-center justify-center rounded-full"
      :class="stageIcon.class"
    >
      <CommonIcon :name="stageIcon.name" size="small" decorative />
    </span>
    <CommonUserAvatar
      v-else-if="notification.createdBy"
      class="shrink-0"
      :entity="notification.createdBy"
      no-indicator
      no-muted
      decorative
    />
    <CommonAvatar v-else class="shrink-0 bg-red-bright text-white" icon="lock" decorative />
    <component
      :is="link ? 'CommonLink' : 'button'"
      :link="link"
      :type="link ? undefined : 'button'"
      class="flex grow flex-col gap-1 text-start"
      @click="markSeen"
    >
      <!-- The message escapes the ticket's title; only its |…| parts become bold. -->
      <!-- eslint-disable vue/no-v-html -->
      <span
        class="text-base leading-snug"
        :class="{ 'font-semibold': !notification.seen }"
        v-html="highlightedMessage"
      />
      <!-- eslint-enable vue/no-v-html -->
      <CommonDateTime
        class="text-xs text-gray"
        :date-time="notification.createdAt"
        type="relative"
      />
    </component>
    <span
      role="status"
      class="size-2.5 shrink-0 rounded-full"
      :class="{ 'bg-blue': !notification.seen }"
      :aria-label="notification.seen ? $t('Notification read') : $t('Unread notification')"
    />
    <button
      type="button"
      class="flex size-11 shrink-0 items-center justify-center rounded-full text-gray disabled:opacity-50"
      :aria-label="$t('Delete notification')"
      :disabled="deleting"
      @click="deleteNotification(notification.id)"
    >
      <CommonIcon name="delete" size="small" decorative />
    </button>
  </li>
</template>
