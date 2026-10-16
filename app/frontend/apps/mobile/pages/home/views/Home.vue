<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import CommonSectionMenu from '#mobile/components/CommonSectionMenu/CommonSectionMenu.vue'
import type { MenuItem } from '#mobile/components/CommonSectionMenu/index.ts'
import { useTicketOverviews } from '#mobile/entities/ticket/composables/useTicketOverviews.ts'

import StudenthubHomeTiles from '../components/StudenthubHomeTiles.vue'

const session = useSessionStore()

// Student Hub: no menu above the overviews. "Ticket overviews" is one of the tiles
// (StudenthubHomeTiles), and the developers' Playground page is removed.

const overviews = useTicketOverviews()

const ticketOverview = computed<MenuItem[]>(() => {
  if (overviews.loading) return []

  return overviews.includedOverviews.map((overview) => {
    return {
      type: 'link',
      link: `/tickets/view/${overview.link}`,
      label: overview.name,
      information: overview.ticketCount,
    }
  })
})
</script>

<template>
  <div class="p-4">
    <!-- Student Hub: design option 5, a header with search, then the tiles. -->
    <header class="mt-2 mb-5 flex items-center justify-between">
      <div>
        <p class="text-sm font-semibold text-gray">{{ $c.product_name }}</p>
        <h1 class="text-3xl font-extrabold">{{ $t('Home') }}</h1>
      </div>
      <CommonLink
        :aria-label="$t('Search…')"
        link="/search"
        class="flex size-11 items-center justify-center rounded-xl bg-gray-500"
      >
        <CommonIcon name="search" size="small" decorative />
      </CommonLink>
    </header>
    <StudenthubHomeTiles class="mb-5" />
    <CommonSectionMenu
      v-if="session.hasPermission(['ticket.agent', 'ticket.customer'])"
      :items="ticketOverview"
      :header-label="__('Ticket overview')"
      :action-label="__('Edit')"
      action-link="/favorite/ticket-overviews/edit"
    >
      <template v-if="overviews.loading" #before-items>
        <div class="flex w-full justify-center">
          <CommonIcon name="loading" animation="spin" />
        </div>
      </template>
    </CommonSectionMenu>
  </div>
</template>
