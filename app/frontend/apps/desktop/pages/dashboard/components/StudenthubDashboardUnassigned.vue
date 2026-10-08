<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { i18n } from '#shared/i18n.ts'

import type { StudenthubUnassignedTeam } from '../composables/useStudenthubDashboardUnassigned.ts'

// Student Hub: on the agents' dashboard, one card per team of the agent with its unassigned open
// tickets: how many, how many are overdue, the longest-waiting ones and a link to the Teams view
// (where unassigned tickets come first).
interface Props {
  teams: StudenthubUnassignedTeam[]
  isLoading?: boolean
  loadFailed?: boolean
}

defineProps<Props>()
</script>

<template>
  <section class="sh-dash-unassigned" :aria-label="$t('Unassigned in your teams')">
    <h2 class="sh-dash-label">{{ $t('Unassigned in your teams') }}</h2>

    <p v-if="loadFailed && !teams.length" class="sh-dash-empty">
      {{ $t('The unassigned tickets could not be loaded. Try Refresh.') }}
    </p>
    <p v-else-if="!teams.length" class="sh-dash-empty">
      {{ isLoading ? $t('Loading…') : $t('You are not in any team yet.') }}
    </p>

    <div v-else class="sh-dash-unassigned__grid">
      <section v-for="team in teams" :key="team.id" class="sh-dash-card" :aria-label="team.name">
        <header class="sh-dash-card__head">
          <span class="sh-dash-sq"><CommonIcon name="person-x" size="xs" decorative /></span>
          <h3>{{ team.name }}</h3>
          <CommonLink
            v-if="team.view_link"
            class="sh-dash-card__link"
            :link="`/tickets/view/${team.view_link}`"
            internal
          >
            {{ $t('View team') }} →
          </CommonLink>
        </header>

        <div class="sh-dash-row">
          <span class="sh-dash-big"
            >{{ team.count }}<small>{{ $t('unassigned') }}</small></span
          >
          <span v-if="team.overdue" class="sh-dash-chip" data-tone="bad">
            {{ $t('%s overdue', team.overdue) }}
          </span>
          <span v-else-if="!team.count" class="sh-dash-chip" data-tone="good">{{
            $t('All assigned')
          }}</span>
        </div>

        <ol v-if="team.oldest.length" class="sh-dash-waiting">
          <li v-for="ticket in team.oldest" :key="ticket.id">
            <CommonLink :link="`/tickets/${ticket.id}`" internal>#{{ ticket.number }}</CommonLink>
            <span :title="ticket.title">{{ ticket.title }}</span>
            <time :datetime="ticket.created_at" :title="i18n.dateTime(ticket.created_at)">
              {{ i18n.relativeDateTime(ticket.created_at) }}
            </time>
          </li>
        </ol>
        <span v-if="team.count > team.oldest.length" class="sh-dash-sub">
          {{ $t('%s more waiting', team.count - team.oldest.length) }}
        </span>
      </section>
    </div>
  </section>
</template>
