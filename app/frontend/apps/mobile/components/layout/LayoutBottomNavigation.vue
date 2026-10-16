<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->
<script setup lang="ts">
import { computed, toRef } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import { useOnlineNotificationCount } from '#shared/entities/online-notification/composables/useOnlineNotificationCount.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import { useCustomLayout } from './useCustomLayout.ts'

const user = toRef(useSessionStore(), 'user')
const { isCustomLayout } = useCustomLayout()
const { unseenCount } = useOnlineNotificationCount()

const notificationCount = computed(() => {
  if (!unseenCount.value) return ''
  if (unseenCount.value > 99) return '99+'
  return unseenCount.value.toString()
})
</script>

<template>
  <!-- Student Hub: design option 5, labels under the icons and a rounded top; same height. -->
  <footer
    class="bottom-navigation fixed bottom-0 z-10 w-full rounded-t-3xl bg-gray-light shadow-[0_-6px_20px_rgb(20_35_75/6%)] backdrop-blur-lg"
    :class="{ 'px-4': isCustomLayout }"
    data-bottom-navigation
  >
    <div v-if="!isCustomLayout" class="flex h-14 w-full items-center text-center font-semibold">
      <CommonLink
        link="/"
        size="small"
        class="flex flex-1 flex-col items-center gap-0.5"
        exact-active-class="text-blue"
      >
        <CommonIcon name="home" size="base" decorative />
        {{ $t('Home') }}
      </CommonLink>
      <CommonLink
        link="/notifications"
        size="small"
        exact-active-class="text-blue"
        class="relative flex flex-1 flex-col items-center gap-0.5"
      >
        <div
          v-if="notificationCount"
          role="status"
          :aria-label="$t('Unread notifications')"
          class="absolute top-0 h-4 min-w-[1rem] rounded-full bg-blue px-1 text-center text-xs text-black ltr:ml-6 rtl:mr-6"
        >
          {{ notificationCount }}
        </div>
        <CommonIcon name="notification-subscribed" size="base" decorative />
        {{ $t('Notifications') }}
      </CommonLink>
      <CommonLink
        link="/account"
        size="small"
        class="group flex flex-1 flex-col items-center gap-0.5"
        exact-active-class="user-active"
      >
        <CommonUserAvatar
          v-if="user"
          :entity="user"
          class="group-[.user-active]:rounded-full group-[.user-active]:ring-2 group-[.user-active]:ring-blue"
          size="xs"
          personal
        />
        {{ $t('Account') }}
      </CommonLink>
    </div>
  </footer>
</template>

<style scoped>
.bottom-navigation {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
