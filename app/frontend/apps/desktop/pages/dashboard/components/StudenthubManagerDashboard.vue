<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'

import StudenthubManagerSiteStats from './StudenthubManagerSiteStats.vue'

// Student Hub: the dashboard of managers who have no other staff role (Ticket Approvals).
// Their own approvals only: what waits for them, what they decided, and what they approved
// that is still open (GET /api/v1/ticket_approval/dashboard), and the numbers of the sites
// assigned to them (StudenthubManagerSiteStats).

interface TicketRef {
  ticket_id: number
  number: string
  title: string
}

interface ManagerDashboard {
  waiting: { count: number; oldest_requested_at: string | null; overdue: boolean }
  decisions: { approved: number; denied: number; approval_rate: number | null }
  still_open: { count: number; tickets: (TicketRef & { decided_at: string; owner: string | null })[] }
  recent: (TicketRef & {
    state: 'approved' | 'denied'
    comment: string | null
    decided_at: string
    requested_by: string | null
  })[]
  settings: { decisions_period_days: number; waiting_warning_hours: number; still_open_after_days: number }
}

const session = useSessionStore()
const firstName = computed(() => session.user?.firstname || session.user?.login || '')

const data = ref<ManagerDashboard | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')

const load = () => {
  isLoading.value = true
  // fetch can throw at once (tests), so start it inside the promise chain.
  return Promise.resolve()
    .then(() =>
      fetch('/api/v1/ticket_approval/dashboard', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    .then(async (response) => {
      if (!response.ok) throw new Error(`${response.status}`)
      data.value = await response.json()
      errorMessage.value = ''
    })
    .catch(() => {
      errorMessage.value = __('The dashboard could not be loaded. Try Refresh.')
    })
    .finally(() => {
      isLoading.value = false
    })
}

const siteStats = useTemplateRef<InstanceType<typeof StudenthubManagerSiteStats>>('site-stats')

const refreshAll = () => Promise.all([load(), siteStats.value?.load()])

onMounted(load)

const decidedTotal = computed(() =>
  data.value ? data.value.decisions.approved + data.value.decisions.denied : 0,
)

const approvedShare = computed(() =>
  decidedTotal.value ? (data.value!.decisions.approved / decidedTotal.value) * 100 : 0,
)

const ticketLink = (ticket: TicketRef) => `/tickets/${ticket.ticket_id}`
</script>

<template>
  <LayoutMain
    background-variant="tertiary"
    class="bg-slate-50 p-6 md:p-8 dark:bg-slate-900/60"
  >
    <div class="mx-auto max-w-[1440px] space-y-8 text-slate-800 dark:text-slate-100">
      <header
        class="flex flex-col justify-between gap-5 rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm md:flex-row md:items-center md:p-8 dark:border-slate-700/80 dark:bg-slate-800"
      >
        <div>
          <h1 class="text-2xl font-black tracking-tight text-slate-900 md:text-3xl dark:text-white">
            {{ $t('Welcome back, %s', firstName) }}
          </h1>
          <p class="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
            {{ $t('Your approvals at a glance.') }}
          </p>
        </div>
        <button
          type="button"
          class="flex items-center gap-2 self-start rounded-xl border border-slate-200/80 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200/80 md:self-auto dark:border-slate-600 dark:bg-slate-700/60 dark:text-slate-200 dark:hover:bg-slate-700"
          :disabled="isLoading"
          @click="refreshAll"
        >
          <CommonIcon name="arrow-repeat" size="tiny" decorative :class="{ 'animate-spin': isLoading }" />
          {{ isLoading ? $t('Refreshing…') : $t('Refresh') }}
        </button>
      </header>

      <CommonAlert v-if="errorMessage" variant="danger">{{ $t(errorMessage) }}</CommonAlert>

      <div v-if="data" class="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-7">
        <!-- Waiting for you -->
        <section class="sh-mgr-card" :aria-label="$t('Waiting for you')">
          <div>
            <h2 class="sh-mgr-card__title">{{ $t('Waiting for you') }}</h2>
            <p class="sh-mgr-card__hint">{{ $t('Requests that need your decision') }}</p>
          </div>
          <div class="flex flex-wrap items-baseline gap-3">
            <span class="sh-mgr-card__number" data-test-id="manager-waiting-count">{{ data.waiting.count }}</span>
            <span
              v-if="data.waiting.overdue"
              class="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
            >
              {{ $t('Waiting over %s hours', data.settings.waiting_warning_hours) }}
            </span>
          </div>
          <p v-if="data.waiting.oldest_requested_at" class="text-sm text-slate-600 dark:text-slate-300">
            {{ $t('Oldest request:') }}
            <CommonDateTime :date-time="data.waiting.oldest_requested_at" type="relative" />
          </p>
          <p v-else class="text-sm text-slate-600 dark:text-slate-300">{{ $t('Nothing waits for you.') }}</p>
          <footer class="sh-mgr-card__footer">
            <CommonLink link="/tickets/view/awaiting_my_approval" internal class="font-semibold">
              {{ $t('Open Awaiting my approval') }} →
            </CommonLink>
          </footer>
        </section>

        <!-- Your decisions -->
        <section class="sh-mgr-card" :aria-label="$t('Your decisions')">
          <div>
            <h2 class="sh-mgr-card__title">{{ $t('Your decisions') }}</h2>
            <p class="sh-mgr-card__hint">{{ $t('Last %s days', data.settings.decisions_period_days) }}</p>
          </div>
          <template v-if="decidedTotal">
            <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2">
              <span class="sh-mgr-card__number">{{ data.decisions.approval_rate }}%</span>
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ $t('approved') }}</span>
            </div>
            <div
              class="flex h-2.5 overflow-hidden rounded-full bg-red-200 dark:bg-red-900/50"
              role="img"
              :aria-label="$t('%s approved, %s denied', data.decisions.approved, data.decisions.denied)"
            >
              <span class="h-full bg-emerald-600" :style="{ width: `${approvedShare}%` }" />
            </div>
            <dl class="flex gap-6 text-sm">
              <div class="flex gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">{{ $t('Approved') }}</dt>
                <dd class="font-bold text-emerald-700 tabular-nums dark:text-emerald-400">{{ data.decisions.approved }}</dd>
              </div>
              <div class="flex gap-1.5">
                <dt class="text-slate-500 dark:text-slate-400">{{ $t('Denied') }}</dt>
                <dd class="font-bold text-red-700 tabular-nums dark:text-red-400">{{ data.decisions.denied }}</dd>
              </div>
            </dl>
          </template>
          <p v-else class="text-sm text-slate-600 dark:text-slate-300">
            {{ $t('No decisions in the last %s days.', data.settings.decisions_period_days) }}
          </p>
        </section>

        <!-- Approved but still open -->
        <section class="sh-mgr-card" :aria-label="$t('Approved but still open')">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h2 class="sh-mgr-card__title">{{ $t('Approved but still open') }}</h2>
              <p class="sh-mgr-card__hint">
                {{ $t('You approved these over %s days ago and they are not resolved yet', data.settings.still_open_after_days) }}
              </p>
            </div>
            <span class="sh-mgr-card__number sh-mgr-card__number--small">{{ data.still_open.count }}</span>
          </div>
          <ul v-if="data.still_open.tickets.length" class="sh-mgr-list">
            <li v-for="ticket in data.still_open.tickets" :key="ticket.ticket_id">
              <CommonLink :link="ticketLink(ticket)" internal class="sh-mgr-list__title">
                <span class="font-mono text-xs text-slate-500 dark:text-slate-400">#{{ ticket.number }}</span>
                {{ ticket.title }}
              </CommonLink>
              <span class="sh-mgr-list__meta">
                {{ ticket.owner ?? $t('No owner') }} · {{ $t('approved') }}
                <CommonDateTime :date-time="ticket.decided_at" type="relative" />
              </span>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-600 dark:text-slate-300">{{ $t('Nothing is waiting on follow-up.') }}</p>
        </section>

        <!-- Your recent decisions -->
        <section class="sh-mgr-card" :aria-label="$t('Your recent decisions')">
          <div>
            <h2 class="sh-mgr-card__title">{{ $t('Your recent decisions') }}</h2>
            <p class="sh-mgr-card__hint">{{ $t('The last five') }}</p>
          </div>
          <ul v-if="data.recent.length" class="sh-mgr-list">
            <li v-for="decision in data.recent" :key="`${decision.ticket_id}-${decision.decided_at}`">
              <span class="flex min-w-0 items-center gap-2">
                <CommonBadge :variant="decision.state === 'approved' ? 'success' : 'danger'" size="xs">
                  {{ decision.state === 'approved' ? $t('Approved') : $t('Denied') }}
                </CommonBadge>
                <CommonLink :link="ticketLink(decision)" internal class="sh-mgr-list__title">
                  <span class="font-mono text-xs text-slate-500 dark:text-slate-400">#{{ decision.number }}</span>
                  {{ decision.title }}
                </CommonLink>
              </span>
              <span v-if="decision.comment" class="sh-mgr-list__comment">“{{ decision.comment }}”</span>
              <span class="sh-mgr-list__meta">
                <template v-if="decision.requested_by">{{ $t('asked by %s', decision.requested_by) }} · </template>
                <CommonDateTime :date-time="decision.decided_at" type="relative" />
              </span>
            </li>
          </ul>
          <p v-else class="text-sm text-slate-600 dark:text-slate-300">{{ $t('You have not decided any requests yet.') }}</p>
        </section>
      </div>

      <StudenthubManagerSiteStats ref="site-stats" />
    </div>
  </LayoutMain>
</template>

<style scoped>
.sh-mgr-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.75rem;
  border: 1px solid rgb(226 232 240 / 0.9);
  border-radius: 1.5rem;
  background-color: #ffffff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 0.04);
}

[data-theme='dark'] .sh-mgr-card {
  border-color: rgb(51 65 85 / 0.8);
  background-color: rgb(30 41 59);
}

.sh-mgr-card__title {
  font-size: 0.875rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: rgb(71 85 105);
}

.sh-mgr-card__hint {
  margin-top: 0.25rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(100 116 139);
}

.sh-mgr-card__number {
  font-size: 3rem;
  line-height: 1;
  font-weight: 900;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: rgb(15 23 42);
}

.sh-mgr-card__number--small {
  font-size: 2rem;
}

[data-theme='dark'] .sh-mgr-card__title {
  color: rgb(203 213 225);
}

[data-theme='dark'] .sh-mgr-card__number {
  color: #ffffff;
}

.sh-mgr-card__footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgb(241 245 249);
  font-size: 0.875rem;
}

.sh-mgr-list {
  display: flex;
  flex-direction: column;
}

.sh-mgr-list > li {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
  padding-block: 0.625rem;
  border-top: 1px solid rgb(241 245 249);
}

.sh-mgr-list > li:first-child {
  border-top: 0;
}

.sh-mgr-list__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  font-weight: 600;
}

.sh-mgr-list__comment {
  overflow-wrap: anywhere;
  font-size: 0.8125rem;
  color: rgb(71 85 105);
}

.sh-mgr-list__meta {
  font-size: 0.75rem;
  color: rgb(100 116 139);
}
</style>
