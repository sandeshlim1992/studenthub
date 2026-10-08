<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubNow } from '#desktop/components/Ticket/StudenthubTicketCells/useStudenthubNow.ts'
import {
  isOverdue,
  waitClock,
  type ManagerDashboard,
  type ManagerWaitingRequest,
} from '#desktop/pages/dashboard/utils/studenthubManagerDashboard.ts'

import StudenthubFlapTime from './StudenthubFlapTime.vue'

// Student Hub manager dashboard: "Next in line", the requests waiting for the manager, longest
// wait first. Picking one opens it in the request card. Empty: "All caught up" and the last decision.
interface Props {
  requests: ManagerWaitingRequest[]
  selectedId: number | null
  warningHours: number
  lastDecision: ManagerDashboard['recent'][number] | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [ticketId: number]
}>()

const now = useStudenthubNow()

const rows = computed(() =>
  props.requests.map((request, index) => ({
    request,
    clock: waitClock(request.requested_at, now.value),
    overdue: isOverdue(request.requested_at, now.value, props.warningHours),
    isNew: now.value.getTime() - new Date(request.requested_at).getTime() < 3_600_000,
    selected: props.selectedId === request.ticket_id || (props.selectedId === null && index === 0),
  })),
)
</script>

<template>
  <section
    aria-labelledby="sh-manager-queue-title"
    class="min-w-0 overflow-hidden rounded-xl border border-[var(--sh-line)] bg-white"
  >
    <header
      class="flex items-baseline justify-between gap-3 border-b border-[#e8eaee] px-4 pt-3.5 pb-2.5"
    >
      <h2 id="sh-manager-queue-title" class="text-[17px] font-bold text-[var(--sh-ink)]">
        {{ $t('Next in line') }}
      </h2>
      <span class="text-sm text-[var(--sh-ink-2)]">
        {{ requests.length ? $t('%s waiting · longest first', requests.length) : $t('0 waiting') }}
      </span>
    </header>

    <ol v-if="requests.length" class="p-1.5" data-test-id="manager-queue">
      <li v-for="row in rows" :key="row.request.ticket_id">
        <button
          type="button"
          class="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-0.5 rounded-lg p-2.5 text-start text-[var(--sh-ink)] hover:bg-[var(--sh-row-hover)] focus-visible:outline-2 focus-visible:outline-[var(--sh-app)]"
          :class="{ 'bg-app-soft': row.selected }"
          :aria-current="row.selected ? 'true' : undefined"
          @click="emit('select', row.request.ticket_id)"
        >
          <StudenthubFlapTime
            class="row-span-2"
            :value="row.clock"
            :overdue="row.overdue"
            :label="$t('Waiting %s (hours:minutes)', row.clock)"
          />
          <span class="truncate" :class="row.selected ? 'font-bold' : 'font-semibold'">{{
            row.request.title
          }}</span>
          <span class="flex min-w-0 items-center gap-2 text-sm text-[var(--sh-muted)]">
            <span class="truncate"
              >#{{ row.request.number
              }}<template v-if="row.request.requested_by">
                · {{ row.request.requested_by }}</template
              ></span
            >
            <span
              v-if="row.overdue"
              class="shrink-0 rounded bg-[#fdeac4] px-1.5 text-xs font-bold text-[#7a4300]"
            >
              {{ $t('Over %s h', warningHours) }}
            </span>
            <span
              v-else-if="row.isNew"
              class="shrink-0 rounded bg-[#eef0f3] px-1.5 text-xs font-bold text-[var(--sh-ink-2)]"
            >
              {{ $t('New') }}
            </span>
          </span>
        </button>
      </li>
    </ol>

    <template v-else>
      <div
        class="flex flex-col items-center gap-2 px-6 pt-8 pb-7 text-center"
        data-test-id="manager-all-caught-up"
      >
        <span
          aria-hidden="true"
          class="grid size-14 place-items-center rounded-full bg-[#e3f2e8] text-[#1d6b3a]"
        >
          <CommonIcon name="check2" size="medium" decorative />
        </span>
        <h3 class="mt-1.5 text-xl font-bold text-[var(--sh-ink)]">{{ $t('All caught up') }}</h3>
        <p class="max-w-[32ch] text-sm text-[var(--sh-ink-2)]">
          {{
            $t(
              'Nothing is waiting for your decision. New requests appear here, in your notifications and by email.',
            )
          }}
        </p>
      </div>
      <div v-if="lastDecision" class="border-t border-[#e8eaee] bg-[#fafbfc] px-4 pt-3 pb-3.5">
        <span class="block text-xs text-[var(--sh-muted)]">{{ $t('Your last decision') }}</span>
        <CommonLink
          :link="`/tickets/${lastDecision.ticket_id}`"
          internal
          class="mt-0.5 flex items-baseline gap-2 text-sm text-[var(--sh-ink)]!"
        >
          <span
            class="shrink-0 rounded px-1.5 text-xs font-bold"
            :class="
              lastDecision.state === 'approved'
                ? 'bg-[#e2f0e6] text-[#1d6b3a]'
                : 'bg-[#fbe5e2] text-[#a3231a]'
            "
          >
            {{ lastDecision.state === 'approved' ? $t('Approved') : $t('Denied') }}
          </span>
          <span class="min-w-0 truncate font-semibold">{{ lastDecision.title }}</span>
          <CommonDateTime
            class="ms-auto shrink-0 text-[var(--sh-muted)]"
            :date-time="lastDecision.decided_at"
            type="relative"
          />
        </CommonLink>
      </div>
    </template>
  </section>
</template>
