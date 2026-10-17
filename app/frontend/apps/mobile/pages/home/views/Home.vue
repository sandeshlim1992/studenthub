<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import CommonSectionMenu from '#mobile/components/CommonSectionMenu/CommonSectionMenu.vue'
import type { MenuItem } from '#mobile/components/CommonSectionMenu/index.ts'
import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'
import { useTicketOverviews } from '#mobile/entities/ticket/composables/useTicketOverviews.ts'

import StudenthubLatestTicket from '../components/StudenthubLatestTicket.vue'
import StudenthubPopularAnswers from '../components/StudenthubPopularAnswers.vue'
import StudenthubQuickLinks from '../components/StudenthubQuickLinks.vue'

const session = useSessionStore()

// Student Hub: Home is design C1 for students: the coloured header, search, their latest
// ticket, the admins' popular answers and quick links, and the help articles. New request and
// Tickets are in the bottom menu. Staff, who only reach the mobile app on a computer, keep their
// favourite overviews below.

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
  <div>
    <StudenthubAppHeader
      :title="
        session.user?.firstname
          ? $t('How can we help, %s?', session.user.firstname)
          : $t('How can we help?')
      "
    />
    <div class="-mt-7 flex flex-col gap-4.5 px-5 pb-5">
      <CommonLink
        :link="session.hasPermission('ticket.customer') ? '/find' : '/search'"
        class="flex h-14 items-center gap-2.5 rounded-2xl bg-gray-500 px-4 text-base text-gray shadow-[0_6px_18px_rgb(20_35_75/12%)]"
      >
        <CommonIcon name="search" size="small" decorative />
        {{ $t('Search…') }}
      </CommonLink>
      <StudenthubLatestTicket />
      <StudenthubPopularAnswers />
      <StudenthubQuickLinks />
      <CommonLink
        v-if="$c.kb_active"
        link="/knowledge-base"
        class="flex items-center gap-3 rounded-2xl bg-gray-500 px-4 py-3.5"
      >
        <CommonIcon name="book" size="small" class="text-blue" decorative />
        <span class="grow text-base font-semibold">{{ $t('Help articles') }}</span>
        <CommonIcon name="chevron-right" size="small" class="text-gray" decorative />
      </CommonLink>
      <CommonSectionMenu
        v-if="session.hasPermission('ticket.agent')"
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
  </div>
</template>
