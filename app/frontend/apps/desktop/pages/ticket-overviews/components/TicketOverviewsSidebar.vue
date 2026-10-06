<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import TicketOverviewsList from '#desktop/pages/ticket-overviews/components/TicketOverviewsSidebar/TicketOverviewsList.vue'
import { useStudenthubTicketViews } from '#desktop/pages/ticket-overviews/composables/useStudenthubTicketViews.ts'

const { hasPermission } = useSessionStore()

const hasOverviewSortingPreference = computed(() =>
  hasPermission('user_preferences.overview_sorting'),
)

// Student Hub: views panel in groups (Approval needed, My views, Teams, Institutions).
const { overviewsBySection } = useStudenthubTicketViews()
</script>

<template>
  <section class="flex flex-col gap-2.5">
    <!-- Group labels are not headings: the sidebar and each list already have accessible names. -->
    <template v-if="overviewsBySection.approvals.length">
      <p class="flex min-h-10 items-center ps-2.5 text-sm font-extrabold tracking-wide text-slate-800 uppercase">
        {{ $t('Approval needed') }}
      </p>
      <TicketOverviewsList section="approvals" :label="__('Approval views')" />
    </template>

    <div
      class="flex min-h-10 items-center justify-between gap-2 ps-2.5"
      :class="{ 'mt-3': overviewsBySection.approvals.length }"
    >
      <p class="text-sm font-extrabold tracking-wide text-slate-800 uppercase">{{ $t('My views') }}</p>
      <CommonLink
        v-if="hasOverviewSortingPreference"
        class="my-2.5"
        internal
        link="/personal-setting/ticket-overviews"
      >
        <CommonLabel
          class="text-app! hover:text-app-hover! font-semibold"
          prefix-icon="list-columns-reverse"
          size="small"
        >
          {{ $t('reorder items') }}
        </CommonLabel>
      </CommonLink>
    </div>

    <TicketOverviewsList />

    <template v-if="overviewsBySection.teams.length">
      <p class="mt-3 ps-2.5 text-sm font-extrabold tracking-wide text-slate-800 uppercase">{{ $t('Teams') }}</p>
      <TicketOverviewsList section="teams" :label="__('Team views')" />
    </template>

    <template v-if="overviewsBySection.institutions.length">
      <p class="mt-3 ps-2.5 text-sm font-extrabold tracking-wide text-slate-800 uppercase">
        {{ $t('Institutions') }}
      </p>
      <TicketOverviewsList section="institutions" :label="__('Institution views')" />
    </template>
  </section>
</template>
