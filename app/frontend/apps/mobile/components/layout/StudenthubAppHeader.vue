<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useSessionStore } from '#shared/stores/session.ts'

// Student Hub: the coloured header of Home, the Tickets tab and the Knowledge Base (design C1).
// Notifications and the account moved here from the bottom menu, which has New request and
// Tickets instead. Pages below Home have a back button in place of the product name, and may say
// where they are above the title.

defineProps<{
  title: string
  context?: string
  backLink?: string
  backLabel?: string
}>()

const user = toRef(useSessionStore(), 'user')
const { unseenCount } = useOnlineNotificationCount()

const notificationCount = computed(() => {
  if (!unseenCount.value) return ''
  if (unseenCount.value > 99) return '99+'
  return unseenCount.value.toString()
})
</script>

<template>
  <header class="flex flex-col gap-4.5 bg-blue px-5 pt-5 pb-13">
    <div class="flex items-center justify-between">
      <CommonLink
        v-if="backLink"
        :link="backLink"
        :aria-label="backLabel || $t('Back')"
        class="flex size-11 items-center justify-center rounded-full bg-white/15"
      >
        <CommonIcon name="chevron-left" size="small" decorative />
      </CommonLink>
      <span v-else class="text-base font-bold">{{ $c.product_name }}</span>
      <div class="flex gap-2">
        <CommonLink
          link="/notifications"
          :aria-label="$t('Notifications')"
          class="relative flex size-11 items-center justify-center rounded-full bg-white/15"
        >
          <CommonIcon name="notification-subscribed" size="small" decorative />
          <span
            v-if="notificationCount"
            role="status"
            :aria-label="$t('Unread notifications')"
            class="absolute top-1.5 h-4 min-w-4 rounded-full bg-gray-500 px-1 text-center text-[10px] leading-4 font-extrabold text-blue ltr:right-1.5 rtl:left-1.5"
          >
            {{ notificationCount }}
          </span>
        </CommonLink>
        <CommonLink
          link="/account"
          :aria-label="$t('Account')"
          class="flex size-11 items-center justify-center rounded-full bg-gray-500"
        >
          <CommonUserAvatar v-if="user" :entity="user" size="medium" personal decorative />
        </CommonLink>
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <p v-if="context" class="text-sm text-white/85">{{ context }}</p>
      <h1 class="text-2xl font-extrabold">{{ title }}</h1>
      <slot />
    </div>
  </header>
</template>
