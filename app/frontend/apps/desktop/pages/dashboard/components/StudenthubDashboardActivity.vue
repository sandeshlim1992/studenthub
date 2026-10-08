<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { i18n } from '#shared/i18n.ts'

import { avatarColor, initials } from '../utils/studenthubDashboard.ts'

import type { StudenthubDashboardActivityItem } from '../composables/useStudenthubDashboardActivity.ts'

// Student Hub: the latest ticket activity on the dashboards, as "who did what on which ticket".
interface Props {
  items: StudenthubDashboardActivityItem[]
  isLoading?: boolean
  loadFailed?: boolean
}

defineProps<Props>()

const ACTIONS: Record<StudenthubDashboardActivityItem['action'], string> = {
  created: __('created'),
  updated: __('updated'),
  replied: __('replied to'),
  wrote: __('wrote on'),
  noted: __('added a note to'),
}
</script>

<template>
  <section class="sh-dash-card" :aria-label="$t('Activity')">
    <header class="sh-dash-card__head">
      <span class="sh-dash-sq"><CommonIcon name="lightning" size="xs" decorative /></span>
      <h2>{{ $t('Activity') }}</h2>
    </header>

    <p v-if="loadFailed && !items.length" class="sh-dash-empty">
      {{ $t('The activity could not be loaded. Try Refresh.') }}
    </p>
    <p v-else-if="!items.length" class="sh-dash-empty">
      {{ isLoading ? $t('Loading…') : $t('No ticket activity yet.') }}
    </p>

    <ol v-else class="sh-dash-feed">
      <li v-for="item in items" :key="item.id">
        <span
          class="sh-dash-avatar"
          :style="{ backgroundColor: avatarColor(item.actor.id) }"
          aria-hidden="true"
        >
          {{ initials(item.actor.name ?? $t('System')) }}
        </span>
        <p>
          <b>{{ item.actor.name ?? $t('System') }}</b>
          {{ $t(ACTIONS[item.action]) }}
          <CommonLink :link="`/tickets/${item.ticket.id}`" internal>#{{ item.ticket.number }}</CommonLink>
          {{ item.ticket.title }}
        </p>
        <time :datetime="item.created_at" :title="i18n.dateTime(item.created_at)">
          {{ i18n.relativeDateTime(item.created_at) }}
        </time>
      </li>
    </ol>
  </section>
</template>
