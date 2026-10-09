<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useSessionStore } from '#shared/stores/session.ts'

import {
  type StudenthubTicketViewSection,
  useStudenthubTicketViews,
} from '#desktop/entities/ticket/composables/useStudenthubTicketViews.ts'
import { useTicketOverviews } from '#desktop/pages/ticket-overviews/composables/useTicketOverviews.ts'

// Student Hub: the ticket views in the navigation panel (design C), in the groups the Tickets page's
// own views column had: Approval needed, My views, Teams, Sites. Links are full paths, so they work
// from the ticket screens too. The view marked is the one the Tickets page and the queue show.

const GROUPS: { section: StudenthubTicketViewSection; title: string; label: string }[] = [
  { section: 'approvals', title: __('Approval needed'), label: __('Approval views') },
  { section: 'mine', title: __('My views'), label: __('Overview navigation list') },
  { section: 'teams', title: __('Teams'), label: __('Team views') },
  { section: 'institutions', title: __('Sites'), label: __('Site views') },
]

const route = useRoute()
const { hasPermission } = useSessionStore()

const { overviewsBySection } = useStudenthubTicketViews()
const { overviewsTicketCountById, currentTicketOverviewLink } = useTicketOverviews()

const groups = computed(() =>
  GROUPS.filter((group) => overviewsBySection.value[group.section].length),
)

const canReorder = computed(() => hasPermission('user_preferences.overview_sorting'))

const isCurrent = (link: string) => link === currentTicketOverviewLink.value
const isCurrentPage = (link: string) => route.name === 'TicketOverview' && isCurrent(link)
</script>

<template>
  <div class="sh-nav-views">
    <section v-for="group in groups" :key="group.section" class="sh-nav-views__group">
      <div class="sh-nav-views__head">
        <p class="sh-nav-panel__label">{{ $t(group.title) }}</p>
        <CommonLink
          v-if="group.section === 'mine' && canReorder"
          v-tooltip="$t('reorder items')"
          class="sh-nav-views__reorder"
          link="/personal-setting/ticket-overviews"
          internal
        >
          <CommonIcon name="list-columns-reverse" size="xs" decorative />
        </CommonLink>
      </div>
      <nav :aria-label="$t(group.label)">
        <ul class="sh-nav-views__list">
          <li v-for="view in overviewsBySection[group.section]" :key="view.id">
            <CommonLink
              class="sh-nav-views__item"
              :class="{ 'sh-nav-views__item--active': isCurrent(view.link) }"
              :aria-current="isCurrentPage(view.link) ? 'page' : undefined"
              :link="`/tickets/view/${view.link}`"
              internal
            >
              <span class="sh-nav-views__name">{{ $t(view.name) }}</span>
              <span
                v-if="overviewsTicketCountById[view.id] !== undefined"
                class="sh-nav-views__count"
                :class="{
                  'sh-nav-views__count--waiting':
                    group.section === 'approvals' && overviewsTicketCountById[view.id] > 0,
                }"
              >
                {{ overviewsTicketCountById[view.id] }}
              </span>
            </CommonLink>
          </li>
        </ul>
      </nav>
    </section>
  </div>
</template>
