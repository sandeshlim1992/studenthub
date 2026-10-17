<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->
<script setup lang="ts">
import { computed } from 'vue'

import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import { useCustomLayout } from './useCustomLayout.ts'

const { isCustomLayout } = useCustomLayout()
const { ticketCreateEnabled } = useTicketCreateView()
const session = useSessionStore()

// Students raise a request in the request chat, staff in Zammad's form.
const newRequestLink = computed(() =>
  session.hasPermission('ticket.customer') ? '/tickets/request' : '/tickets/create',
)

const ticketsLink = computed(() => {
  if (session.hasPermission('ticket.customer')) return '/tickets'
  if (session.hasPermission('ticket.agent')) return '/tickets/view'
  return undefined
})
</script>

<template>
  <!-- Student Hub: design C1, Home, a raised New request button and Tickets (students' own list,
       staff's overviews). Notifications and the account are in the header of Home and Tickets. -->
  <footer
    class="bottom-navigation fixed bottom-0 z-10 w-full bg-gray-light shadow-[0_-6px_20px_rgb(20_35_75/6%)] backdrop-blur-lg"
    :class="{ 'px-4': isCustomLayout }"
    data-bottom-navigation
  >
    <div
      v-if="!isCustomLayout"
      class="grid h-14 w-full grid-cols-3 items-end pb-1.5 text-center font-semibold"
    >
      <CommonLink
        link="/"
        size="small"
        class="flex flex-col items-center gap-0.5"
        exact-active-class="text-blue"
      >
        <CommonIcon name="home" size="base" decorative />
        {{ $t('Home') }}
      </CommonLink>
      <CommonLink
        v-if="ticketCreateEnabled"
        :link="newRequestLink"
        size="small"
        class="flex flex-col items-center gap-1"
      >
        <span
          class="-mt-7 flex size-14.5 items-center justify-center rounded-full border-4 border-black bg-blue shadow-[0_6px_16px_rgb(20_35_75/25%)]"
        >
          <CommonIcon name="add" size="base" decorative />
        </span>
        {{ $t('New request') }}
      </CommonLink>
      <span v-else />
      <CommonLink
        v-if="ticketsLink"
        :link="ticketsLink"
        size="small"
        class="flex flex-col items-center gap-0.5"
        active-class="text-blue"
      >
        <CommonIcon name="all-tickets" size="base" decorative />
        {{ $t('Tickets') }}
      </CommonLink>
    </div>
  </footer>
</template>

<style scoped>
.bottom-navigation {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
