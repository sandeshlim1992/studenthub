<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubDashboardViews } from '#desktop/pages/dashboard/composables/useStudenthubDashboardViews.ts'
import type { StudenthubDashboardViewKey } from '#desktop/pages/dashboard/utils/studenthubDashboard.ts'
import { useTicketOverviews } from '#desktop/pages/ticket-overviews/composables/useTicketOverviews.ts'

// Student Hub: the navigation panel on the Dashboard. The dashboards to switch between (users with
// more than one), then "Needs attention": the user's ticket views that ask for action, with counts.

// Ticket views shown under "Needs attention", in this order, when the user has them (at most 4).
const ATTENTION_LINKS = [
  'awaiting_my_approval',
  'my_assigned',
  'all_unassigned',
  'my_escalated_tickets',
  'all_escalated',
  'my_pending_reached',
  'sent_for_approval',
]
const ATTENTION_MAX = 4

// The ticket view whose count a dashboard shows.
const VIEW_COUNT_LINKS: Partial<Record<StudenthubDashboardViewKey, string>> = {
  mine: 'my_assigned',
  approvals: 'awaiting_my_approval',
}

const { views, view, canSwitch } = useStudenthubDashboardViews()
const { overviewsByLink, overviewsTicketCountById } = useTicketOverviews()

const countOf = (link?: string) => {
  const overview = link ? overviewsByLink.value[link] : undefined
  return overview ? overviewsTicketCountById.value[overview.id] : undefined
}

const attention = computed(() =>
  ATTENTION_LINKS.filter((link) => overviewsByLink.value[link])
    .slice(0, ATTENTION_MAX)
    .map((link) => overviewsByLink.value[link]),
)
</script>

<template>
  <div class="sh-nav-views">
    <section v-if="canSwitch" class="sh-nav-views__group">
      <p class="sh-nav-panel__label">{{ $t('Views') }}</p>
      <div class="sh-nav-views__list" role="group" :aria-label="$t('Dashboard view')">
        <button
          v-for="item in views"
          :key="item.value"
          type="button"
          class="sh-nav-views__item"
          :class="{ 'sh-nav-views__item--active': view === item.value }"
          :aria-pressed="view === item.value"
          @click="view = item.value"
        >
          <span class="sh-nav-views__name">{{ $t(item.label) }}</span>
          <span
            v-if="countOf(VIEW_COUNT_LINKS[item.value]) !== undefined"
            class="sh-nav-views__count"
            :class="{
              'sh-nav-views__count--waiting':
                item.value === 'approvals' && (countOf(VIEW_COUNT_LINKS[item.value]) ?? 0) > 0,
            }"
          >
            {{ countOf(VIEW_COUNT_LINKS[item.value]) }}
          </span>
        </button>
      </div>
    </section>

    <section v-if="attention.length" class="sh-nav-views__group">
      <p class="sh-nav-panel__label">{{ $t('Needs attention') }}</p>
      <nav :aria-label="$t('Needs attention')">
        <ul class="sh-nav-views__list">
          <li v-for="overview in attention" :key="overview.id">
            <CommonLink
              class="sh-nav-views__item"
              :link="`/tickets/view/${overview.link}`"
              internal
            >
              <span class="sh-nav-views__name">{{ $t(overview.name) }}</span>
              <span
                v-if="countOf(overview.link) !== undefined"
                class="sh-nav-views__count"
                :class="{
                  'sh-nav-views__count--waiting':
                    overview.link === 'awaiting_my_approval' && (countOf(overview.link) ?? 0) > 0,
                }"
              >
                {{ countOf(overview.link) }}
              </span>
            </CommonLink>
          </li>
        </ul>
      </nav>
    </section>
  </div>
</template>
