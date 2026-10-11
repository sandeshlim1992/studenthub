<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { formatNumber, ticketDate, type ReportTicket } from '../utils/studenthubReport.ts'

// Student Hub: the tickets behind one series of the Reporting page (Created, Closed…), as Zammad
// gives them: the most recently updated first, at most 100. Download Excel has all of them.

interface Props {
  backends: { name: string; display: string; total?: number }[]
  selected: string
  tickets: ReportTicket[]
  count: number
  visibleRows: number
  loading: boolean
  stateNames: Record<number, string>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [name: string]
  'show-more': []
}>()

const shown = computed(() => props.tickets.slice(0, props.visibleRows))

const stateName = (stateId?: number) => (stateId ? props.stateNames[stateId] : undefined) ?? '–'

const cellClass = 'px-3 py-2.5 align-top'
</script>

<template>
  <section
    class="overflow-hidden rounded-xl border border-[var(--sh-line)] bg-white dark:border-gray-900 dark:bg-gray-500"
  >
    <div
      class="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--sh-line)] px-5 py-3.5 dark:border-gray-900"
    >
      <h2 class="text-base font-semibold">{{ $t('Tickets behind the figures') }}</h2>
      <div
        v-if="backends.length > 1"
        role="group"
        :aria-label="$t('Which tickets')"
        class="flex flex-wrap gap-1"
      >
        <button
          v-for="backend in backends"
          :key="backend.name"
          type="button"
          :aria-pressed="backend.name === selected"
          class="h-8 rounded-lg px-3"
          :class="
            backend.name === selected
              ? 'bg-[var(--sh-app-soft)] font-semibold text-[var(--sh-app)] dark:bg-gray-600 dark:text-white'
              : 'hover:bg-[var(--sh-row-hover)] dark:hover:bg-gray-600'
          "
          @click="emit('select', backend.name)"
        >
          {{ $t(backend.display)
          }}<template v-if="backend.total !== undefined">
            · {{ formatNumber(backend.total) }}</template
          >
        </button>
      </div>
    </div>

    <p v-if="!backends.length" class="m-0 px-5 py-6 text-[var(--sh-muted)] dark:text-neutral-400">
      {{ $t('This measure counts messages, not tickets, so there is no list of tickets.') }}
    </p>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[620px] border-collapse">
          <thead>
            <tr class="text-start text-xs text-[var(--sh-muted)] dark:text-neutral-400">
              <th scope="col" class="px-5 py-2.5 text-start font-semibold">{{ $t('Ticket') }}</th>
              <th scope="col" :class="cellClass" class="text-start font-semibold">
                {{ $t('Title') }}
              </th>
              <th scope="col" :class="cellClass" class="text-start font-semibold">
                {{ $t('Campus') }}
              </th>
              <th scope="col" :class="cellClass" class="text-start font-semibold">
                {{ $t('State') }}
              </th>
              <th scope="col" class="px-5 py-2.5 text-end font-semibold">{{ $t('Created') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-if="loading && !tickets.length"
              class="border-t border-[#eceff3] dark:border-gray-900"
            >
              <td colspan="5" class="px-5 py-6 text-[var(--sh-muted)]">
                {{ $t('Loading tickets…') }}
              </td>
            </tr>
            <tr v-else-if="!tickets.length" class="border-t border-[#eceff3] dark:border-gray-900">
              <td colspan="5" class="px-5 py-6 text-[var(--sh-muted)]">
                {{ $t('No tickets in this period.') }}
              </td>
            </tr>
            <tr
              v-for="ticket in shown"
              :key="ticket.id"
              class="border-t border-[#eceff3] dark:border-gray-900"
            >
              <td class="px-5 py-2.5 align-top font-mono text-[13px]">
                <RouterLink
                  :to="`/tickets/${ticket.id}`"
                  class="font-semibold text-[var(--sh-app)] hover:underline dark:text-blue-300"
                >
                  #{{ ticket.number }}
                </RouterLink>
              </td>
              <td :class="cellClass">{{ ticket.title }}</td>
              <td :class="cellClass" class="text-[var(--sh-muted)] dark:text-neutral-400">
                {{ ticket.campus || '–' }}
              </td>
              <td :class="cellClass">
                <span
                  class="rounded-full bg-[#eef0f3] px-2 py-0.5 text-xs whitespace-nowrap text-[var(--sh-ink)] dark:bg-gray-600 dark:text-white"
                >
                  {{ stateName(ticket.stateId) }}
                </span>
              </td>
              <td
                class="px-5 py-2.5 text-end align-top whitespace-nowrap text-[var(--sh-muted)] tabular-nums dark:text-neutral-400"
              >
                {{ ticketDate(ticket.createdAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        v-if="tickets.length"
        class="flex flex-wrap items-center justify-between gap-3 border-t border-[#eceff3] px-5 py-3 text-xs text-[var(--sh-muted)] dark:border-gray-900 dark:text-neutral-400"
      >
        <p v-if="shown.length >= count" class="m-0">
          {{ $t('Showing all %s.', formatNumber(count)) }}
        </p>
        <p v-else class="m-0">
          {{
            $t(
              'Showing the %s most recently updated of %s. Download Excel has them all.',
              formatNumber(shown.length),
              formatNumber(count),
            )
          }}
        </p>
        <button
          v-if="shown.length < tickets.length"
          type="button"
          class="font-semibold text-[var(--sh-app)] hover:underline dark:text-blue-300"
          @click="emit('show-more')"
        >
          {{ $t('Show more') }}
        </button>
      </div>
    </template>
  </section>
</template>
