<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useTicketCreateView } from '#shared/entities/ticket/composables/useTicketCreateView.ts'
import { useSessionStore } from '#shared/stores/session.ts'

// Student Hub: the home page's shortcuts (design option 5, .dev/DECISIONS.md).

interface Tile {
  link: string
  label: string
  icon: string
  primary?: boolean
  // The Knowledge Base exists only in the new UI, outside the mobile app.
  external?: boolean
}

const { ticketCreateEnabled } = useTicketCreateView()
const session = useSessionStore()

const tiles = computed(() =>
  [
    ticketCreateEnabled.value && {
      link: '/tickets/create',
      label: __('New ticket'),
      icon: 'plus',
      primary: true,
    },
    session.hasPermission(['ticket.agent', 'ticket.customer']) && {
      link: '/tickets/view',
      label: __('Ticket overviews'),
      icon: 'all-tickets',
    },
    { link: '/notifications', label: __('Notifications'), icon: 'notification-subscribed' },
    session.hasPermission(['knowledge_base.reader', 'knowledge_base.editor']) && {
      link: '/knowledge-base',
      label: __('Knowledge Base'),
      icon: 'knowledge-base',
      external: true,
    },
  ].filter((tile): tile is Tile => Boolean(tile)),
)
</script>

<template>
  <nav :aria-label="$t('Shortcuts')" class="grid grid-cols-2 gap-3">
    <CommonLink
      v-for="tile in tiles"
      :key="tile.link"
      :link="tile.link"
      :external="tile.external"
      class="flex h-31 flex-col justify-between rounded-2xl p-4"
      :class="tile.primary ? 'bg-blue' : 'bg-gray-500'"
    >
      <span
        class="flex size-10 items-center justify-center rounded-xl"
        :class="{ 'bg-gray-400': !tile.primary }"
      >
        <CommonIcon :name="tile.icon" size="base" decorative />
      </span>
      <span class="text-base font-bold">{{ $t(tile.label) }}</span>
    </CommonLink>
  </nav>
</template>
