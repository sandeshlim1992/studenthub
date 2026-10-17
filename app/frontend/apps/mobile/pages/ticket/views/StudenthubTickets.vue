<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import CommonLoader from '#mobile/components/CommonLoader/CommonLoader.vue'
import StudenthubAppHeader from '#mobile/components/layout/StudenthubAppHeader.vue'
import StudenthubTicketItem from '#mobile/entities/ticket/components/StudenthubTicketItem.vue'
import { useStudenthubMyTickets } from '#mobile/entities/ticket/composables/useStudenthubMyTickets.ts'
import {
  isStudenthubTicketDone,
  studenthubTicketStage,
  type StudenthubTicketStage,
} from '#mobile/entities/ticket/helpers/studenthubTicketStage.ts'

// Student Hub: the Tickets tab, every ticket the student raised (design C1, .dev/DECISIONS.md),
// to search and narrow down by where they stand.

type Filter = 'all' | 'open' | 'waiting' | 'closed'

const filterMatches: Record<Filter, (stage: StudenthubTicketStage) => boolean> = {
  all: () => true,
  open: (stage) => !isStudenthubTicketDone(stage),
  waiting: (stage) => stage === 'waiting',
  closed: isStudenthubTicketDone,
}

const filterLabels: Record<Filter, string> = {
  all: __('All'),
  open: __('Open'),
  waiting: __('Waiting for you'),
  closed: __('Closed'),
}

type Sort = 'latest' | 'state'

// Sorted by state, tickets follow the way a ticket goes (as Student Hub's state numbers do),
// latest change first within each.
const stageOrder: StudenthubTicketStage[] = ['new', 'progress', 'waiting', 'resolved', 'closed']

const { hasMyTickets, tickets, loading, pagination } = useStudenthubMyTickets()

const shown = ref<Filter>('all')
const sort = ref<Sort>('latest')
const search = ref('')

const ticketsWithStage = computed(() =>
  tickets.value.map((ticket) => ({ ticket, stage: studenthubTicketStage(ticket.state) })),
)

const filters = computed(() =>
  (Object.keys(filterLabels) as Filter[]).map((filter) => ({
    filter,
    label: filterLabels[filter],
    count: ticketsWithStage.value.filter(({ stage }) => filterMatches[filter](stage)).length,
  })),
)

const visibleTickets = computed(() => {
  const words = search.value.trim().toLowerCase()

  const matching = ticketsWithStage.value.filter(
    ({ ticket, stage }) =>
      filterMatches[shown.value](stage) &&
      `${ticket.title} ${ticket.number}`.toLowerCase().includes(words),
  )
  if (sort.value === 'latest') return matching

  return matching.toSorted((a, b) => stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage))
})
</script>

<template>
  <div>
    <StudenthubAppHeader :title="$t('Your tickets')" />
    <div class="-mt-7 flex flex-col gap-3.5 px-5 pb-5">
      <div
        class="flex h-14 items-center gap-2.5 rounded-2xl bg-gray-500 px-4 shadow-[0_6px_18px_rgb(20_35_75/12%)]"
      >
        <CommonIcon name="search" size="small" class="text-gray" decorative />
        <input
          v-model="search"
          type="search"
          class="grow bg-transparent text-base outline-none placeholder:text-gray"
          :placeholder="$t('Search your tickets')"
          :aria-label="$t('Search your tickets')"
        />
      </div>
      <div role="group" :aria-label="$t('Show')" class="-mx-5 flex gap-2 overflow-x-auto px-5">
        <button
          v-for="{ filter, label, count } in filters"
          :key="filter"
          type="button"
          class="h-9 shrink-0 rounded-full border px-3.5 text-sm font-semibold"
          :class="shown === filter ? 'border-blue bg-blue' : 'border-gray-300 bg-gray-500'"
          :aria-pressed="shown === filter"
          @click="shown = filter"
        >
          {{ $t(label) }} ({{ count }})
        </button>
      </div>
      <label
        for="studenthub-tickets-sort"
        class="flex items-center justify-end gap-2 text-sm text-gray"
      >
        {{ $t('Sort by') }}
        <select
          id="studenthub-tickets-sort"
          v-model="sort"
          class="h-9 rounded-xl border border-gray-300 bg-gray-500 px-2.5 text-sm font-semibold text-white"
        >
          <option value="latest">{{ $t('Latest change') }}</option>
          <option value="state">{{ $t('State') }}</option>
        </select>
      </label>
      <CommonLoader :loading="loading">
        <section v-if="visibleTickets.length" class="flex flex-col gap-2.5">
          <StudenthubTicketItem
            v-for="{ ticket } in visibleTickets"
            :key="ticket.id"
            :ticket="ticket"
          />
          <button
            v-if="pagination.hasNextPage"
            type="button"
            class="h-12 rounded-2xl bg-gray-500 text-base font-semibold"
            :disabled="pagination.loadingNewPage"
            @click="pagination.fetchNextPage()"
          >
            {{ $t('Show more') }}
          </button>
        </section>
        <p v-else class="py-6 text-center text-base text-gray">
          {{
            hasMyTickets || loading ? $t('No entries') : $t('Your tickets cannot be shown here.')
          }}
        </p>
      </CommonLoader>
    </div>
  </div>
</template>
