<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import { i18n } from '#shared/i18n.ts'

import LayoutMain from '#desktop/components/layout/LayoutMain.vue'

import { decideApproval, type ManagerDashboard } from '../utils/studenthubManagerDashboard.ts'

import StudenthubManagerMonth from './StudenthubManagerDashboard/StudenthubManagerMonth.vue'
import StudenthubManagerQueue from './StudenthubManagerDashboard/StudenthubManagerQueue.vue'
import StudenthubManagerRequest from './StudenthubManagerDashboard/StudenthubManagerRequest.vue'
import StudenthubManagerSiteStats from './StudenthubManagerSiteStats.vue'

// Student Hub: the managers' dashboard (Ticket Approvals): the only one of managers who have no
// other staff role, "Approvals" on the Dashboard switch for the others.
// One request at a time: "Next in line" lists what waits (longest first), the card shows the
// open one with Approve / Deny, and the next one opens after a decision. Nothing waiting:
// "All caught up" and "Your month in review". Below: approved tickets still open, and recent
// decisions (GET /api/v1/ticket_approval/dashboard), then the numbers of the sites assigned to
// them (StudenthubManagerSiteStats).

const data = ref<ManagerDashboard | null>(null)
const isLoading = ref(false)
const errorMessage = ref('')
const updatedAt = ref<Date | null>(null)

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
      updatedAt.value = new Date()
      errorMessage.value = ''
    })
    .catch(() => {
      errorMessage.value = __('The dashboard could not be loaded. Try Refresh.')
    })
    .finally(() => {
      isLoading.value = false
    })
}

onMounted(load)

const siteStats = useTemplateRef<InstanceType<typeof StudenthubManagerSiteStats>>('site-stats')

const refreshAll = () => Promise.all([load(), siteStats.value?.load()])

const requests = computed(() => data.value?.waiting.requests ?? [])
const selectedId = ref<number | null>(null)

const selectedIndex = computed(() => {
  const index = requests.value.findIndex((request) => request.ticket_id === selectedId.value)
  return index === -1 ? 0 : index
})
const selected = computed(() => requests.value[selectedIndex.value] ?? null)
const nextRequest = computed(() => requests.value[selectedIndex.value + 1] ?? null)

const selectAt = (index: number) => {
  selectedId.value = requests.value[index]?.ticket_id ?? null
}

const isDeciding = ref(false)
const decisionError = ref('')

watch(selected, () => {
  decisionError.value = ''
})
const { notify } = useNotifications()

const decide = async (decision: 'approve' | 'deny', comment: string) => {
  const request = selected.value
  if (!request) return

  isDeciding.value = true
  try {
    await decideApproval(request.ticket_id, decision, comment)
    decisionError.value = ''
  } catch (error) {
    decisionError.value = error instanceof Error ? error.message : String(error)
    return
  } finally {
    isDeciding.value = false
  }

  notify({
    id: 'studenthub-manager-decision',
    message:
      decision === 'approve'
        ? __('Approved #%s. It is back with its team.')
        : __('Denied #%s. It is back with its team.'),
    messagePlaceholder: [request.number],
    type: NotificationTypes.Success,
  })

  // The next request (after the decided one) opens; the reload drops the decided one.
  selectedId.value = nextRequest.value?.ticket_id ?? null
  await load()
}

const updatedTime = computed(() =>
  updatedAt.value?.toLocaleTimeString(i18n.locale(), { hour: '2-digit', minute: '2-digit' }),
)

const lastDecision = computed(() => data.value?.recent[0] ?? null)
const ticketLink = (ticketId: number) => `/tickets/${ticketId}`
</script>

<template>
  <LayoutMain background-variant="tertiary" class="min-h-screen bg-[var(--sh-page)]">
    <div
      class="mx-auto flex max-w-[1240px] flex-col gap-[22px] px-8 pt-7 pb-12 text-[var(--sh-ink)]"
    >
      <!-- The dashboard switch, for managers who also have another dashboard (Dashboard.vue). -->
      <slot name="top" />

      <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div class="min-w-0">
          <h1 class="text-[27px] leading-tight font-bold tracking-tight">
            {{ data && !requests.length ? $t('Nothing to decide') : $t('Next to decide') }}
          </h1>
          <p v-if="data" class="mt-1.5 text-[var(--sh-ink-2)]">
            <template v-if="requests.length">
              {{
                $t(
                  '%s of %s, longest wait first. When you decide, the next request opens.',
                  selectedIndex + 1,
                  requests.length,
                )
              }}
            </template>
            <template v-else>{{
              $t('You’re all caught up. Here is how your last 30 days went.')
            }}</template>
          </p>
        </div>
        <div class="flex items-center gap-3 text-sm text-[var(--sh-ink-2)]">
          <span v-if="updatedAt" class="inline-flex items-center gap-2">
            <span
              class="size-2 rounded-full bg-[#1d8a4a] shadow-[0_0_0_3px_rgb(29_138_74/0.2)]"
              aria-hidden="true"
            ></span>
            {{ $t('Updated %s', updatedTime) }}
          </span>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-md border border-[#c9cdd4] bg-white px-3 font-semibold text-[var(--sh-ink)] hover:bg-[#f4f5f7]"
            :disabled="isLoading"
            @click="refreshAll"
          >
            <CommonIcon
              name="arrow-repeat"
              size="tiny"
              decorative
              :class="{ 'animate-spin': isLoading }"
            />
            {{ isLoading ? $t('Refreshing…') : $t('Refresh') }}
          </button>
        </div>
      </div>

      <CommonAlert v-if="errorMessage" variant="danger">{{ $t(errorMessage) }}</CommonAlert>

      <template v-if="data">
        <div class="flex flex-wrap items-start gap-[22px]">
          <StudenthubManagerQueue
            class="max-w-[400px] flex-[1_1_360px]"
            :requests="requests"
            :selected-id="selected?.ticket_id ?? null"
            :warning-hours="data.settings.waiting_warning_hours"
            :last-decision="lastDecision"
            @select="selectedId = $event"
          />

          <StudenthubManagerRequest
            v-if="selected"
            class="flex-[999_1_520px]"
            :request="selected"
            :position="selectedIndex + 1"
            :total="requests.length"
            :next="nextRequest"
            :warning-hours="data.settings.waiting_warning_hours"
            :busy="isDeciding"
            :error="decisionError"
            @decide="decide"
            @previous="selectAt(selectedIndex - 1)"
            @next="selectAt(selectedIndex + 1)"
          />
          <StudenthubManagerMonth v-else class="flex-[999_1_520px]" :data="data" />
        </div>

        <div class="flex flex-wrap items-stretch gap-[22px]">
          <section
            :aria-label="$t('Back with teams, still open')"
            class="min-w-0 flex-[1_1_420px] rounded-[10px] border border-[var(--sh-line)] bg-white"
          >
            <header
              class="flex items-baseline justify-between border-b border-[#e8eaee] px-[18px] pt-3.5 pb-2.5"
            >
              <h2 class="text-base font-bold">{{ $t('Back with teams, still open') }}</h2>
              <span class="font-bold">{{ data.still_open.count }}</span>
            </header>
            <ul v-if="data.still_open.tickets.length" class="py-1">
              <li
                v-for="ticket in data.still_open.tickets"
                :key="ticket.ticket_id"
                class="flex flex-col gap-0.5 px-[18px] py-2.5"
              >
                <CommonLink
                  :link="ticketLink(ticket.ticket_id)"
                  internal
                  class="font-semibold text-[var(--sh-ink)]!"
                >
                  <span class="sh-condensed font-bold tracking-wide">#{{ ticket.number }}</span>
                  {{ ticket.title }}
                </CommonLink>
                <span class="text-sm text-[var(--sh-ink-2)]">
                  {{ ticket.owner ?? $t('No owner') }} · {{ $t(ticket.state) }} ·
                  <strong class="text-[#7a4300]">
                    {{ $t('approved') }}
                    <CommonDateTime :date-time="ticket.decided_at" type="relative" />
                  </strong>
                </span>
              </li>
            </ul>
            <p v-else class="px-[18px] py-3 text-sm text-[var(--sh-ink-2)]">
              {{ $t('Nothing you approved is waiting on follow-up.') }}
            </p>
          </section>

          <section
            :aria-label="$t('Recent decisions')"
            class="min-w-0 flex-[1_1_420px] rounded-[10px] border border-[var(--sh-line)] bg-white"
          >
            <header class="border-b border-[#e8eaee] px-[18px] pt-3.5 pb-2.5">
              <h2 class="text-base font-bold">{{ $t('Recent decisions') }}</h2>
            </header>
            <ul v-if="data.recent.length" class="py-1">
              <li
                v-for="decision in data.recent"
                :key="`${decision.ticket_id}-${decision.decided_at}`"
                class="flex flex-col gap-0.5 px-[18px] py-2"
              >
                <span class="flex items-center gap-2.5">
                  <span
                    class="sh-condensed w-[76px] shrink-0 font-bold tracking-wide"
                    :class="decision.state === 'approved' ? 'text-[#1d6b3a]' : 'text-[#b42318]'"
                  >
                    {{ decision.state === 'approved' ? $t('APPROVED') : $t('DENIED') }}
                  </span>
                  <CommonLink
                    :link="ticketLink(decision.ticket_id)"
                    internal
                    class="min-w-0 flex-1 truncate font-semibold text-[var(--sh-ink)]!"
                  >
                    {{ decision.title }}
                  </CommonLink>
                  <CommonDateTime
                    class="shrink-0 text-sm text-[var(--sh-ink-2)]"
                    :date-time="decision.decided_at"
                    type="relative"
                  />
                </span>
                <span
                  v-if="decision.comment"
                  class="ps-[86px] text-sm break-words text-[var(--sh-ink-2)]"
                  >“{{ decision.comment }}”</span
                >
              </li>
            </ul>
            <p v-else class="px-[18px] py-3 text-sm text-[var(--sh-ink-2)]">
              {{ $t('You have not decided any requests yet.') }}
            </p>
          </section>
        </div>
      </template>

      <StudenthubManagerSiteStats ref="site-stats" />
    </div>
  </LayoutMain>
</template>
