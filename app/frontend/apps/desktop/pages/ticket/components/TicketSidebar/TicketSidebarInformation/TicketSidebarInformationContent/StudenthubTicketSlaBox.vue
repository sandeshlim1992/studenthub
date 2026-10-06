<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'

import type { TicketById } from '#shared/entities/ticket/types.ts'
import { i18n } from '#shared/i18n.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import StudenthubTicketEscalation from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketEscalation.vue'
import { useStudenthubNow } from '#desktop/components/Ticket/StudenthubTicketCells/useStudenthubNow.ts'
import { formatDayTime, slaElapsedShare, slaResult } from '#desktop/utils/studenthubTicketDetails.ts'
import {
  escalationStatus,
  escalationWarningMinutes,
  formatEscalationDuration,
  STUDENTHUB_STATE_TONES,
} from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: the ticket's SLA as a card (Halo mockup). Open deadlines come with the ticket;
// Zammad clears a deadline once it is reached and keeps the result ("minutes left at that
// moment") on the ticket, which the new UI's ticket query doesn't load, so it is read here.
interface Props {
  ticket: Pick<
    TicketById,
    | 'internalId'
    | 'createdAt'
    | 'updatedAt'
    | 'firstResponseEscalationAt'
    | 'updateEscalationAt'
    | 'closeEscalationAt'
  >
}

interface SlaResults {
  first_response_diff_in_min?: number | null
  close_diff_in_min?: number | null
  // Ticket Approvals can pause the SLA while the ticket waits for a manager.
  paused_for_approval?: boolean
}

interface TicketData {
  first_response_diff_in_min?: number | null
  close_diff_in_min?: number | null
  approval_state?: string | null
  preferences?: { escalation_calculation?: { escalation_disabled?: boolean; sla_id?: number } }
}

const props = defineProps<Props>()

const config = toRef(useApplicationStore(), 'config')
const now = useStudenthubNow()

const results = ref<SlaResults>({})

const loadResults = (ticketId: number) =>
  // fetch can throw at once (tests), so start it inside the promise chain.
  Promise.resolve()
    .then(() => fetch(`/api/v1/tickets/${ticketId}`, { credentials: 'same-origin' }))
    .then((response) => (response.ok ? response.json() : {}))
    .then((data: TicketData) => {
      if (props.ticket.internalId !== ticketId) return
      results.value = {
        first_response_diff_in_min: data.first_response_diff_in_min,
        close_diff_in_min: data.close_diff_in_min,
        paused_for_approval:
          data.approval_state === 'pending' &&
          data.preferences?.escalation_calculation?.escalation_disabled === true &&
          Boolean(data.preferences?.escalation_calculation?.sla_id),
      }
    })
    .catch(() => {
      results.value = {}
    })

// Reload after every change of the ticket: that's when Zammad recalculates the SLA.
watch(
  () => [props.ticket.internalId, props.ticket.updatedAt] as const,
  ([ticketId]) => loadResults(ticketId),
  { immediate: true },
)

const resultLabel = (result: 'met' | 'missed') =>
  result === 'met'
    ? { text: __('Met'), color: STUDENTHUB_STATE_TONES.green.text }
    : { text: __('Missed'), color: STUDENTHUB_STATE_TONES.red.text }

const firstResponse = computed(() => {
  if (props.ticket.firstResponseEscalationAt) return { deadline: props.ticket.firstResponseEscalationAt }

  const result = slaResult(results.value.first_response_diff_in_min)
  return result ? { result: resultLabel(result) } : null
})

const resolution = computed(() => {
  const deadline = props.ticket.closeEscalationAt
  if (!deadline) {
    const result = slaResult(results.value.close_diff_in_min)
    return result ? { result: resultLabel(result) } : null
  }

  const escalation = escalationStatus(
    deadline,
    now.value.getTime(),
    escalationWarningMinutes(config.value.studenthub_escalation_warning_minutes),
  )
  const duration = formatEscalationDuration(escalation.minutes, (text, ...args) =>
    i18n.t(text, ...args),
  )
  const tone =
    escalation.status === 'overdue'
      ? STUDENTHUB_STATE_TONES.red
      : escalation.status === 'soon'
        ? STUDENTHUB_STATE_TONES.amber
        : STUDENTHUB_STATE_TONES.green

  return {
    due: formatDayTime(deadline, now.value),
    dueTooltip: i18n.dateTime(deadline),
    overdue: escalation.status === 'overdue',
    timeLeft: escalation.status === 'overdue' ? i18n.t('overdue %s', duration) : duration,
    share: slaElapsedShare(props.ticket.createdAt, deadline, now.value.getTime()),
    tone,
  }
})

const hasSla = computed(
  () => !!(firstResponse.value || resolution.value || props.ticket.updateEscalationAt),
)
</script>

<template>
  <div class="sh-sla-box" data-test-id="studenthub-ticket-sla">
    <p v-if="results.paused_for_approval" class="text-sm font-medium text-gray-100 dark:text-neutral-400">
      {{ $t('Paused, waiting for approval. The time with the manager does not count.') }}
    </p>
    <p v-else-if="!hasSla" class="text-sm text-gray-100 dark:text-neutral-400">
      {{ $t('No SLA applies to this ticket.') }}
    </p>

    <dl v-else class="sh-sla-box__rows">
      <template v-if="firstResponse">
        <dt>{{ $t('First response') }}</dt>
        <dd>
          <span
            v-if="firstResponse.result"
            class="font-bold"
            :style="{ color: firstResponse.result.color }"
          >
            {{ $t(firstResponse.result.text) }}
          </span>
          <StudenthubTicketEscalation v-else :value="firstResponse.deadline" />
        </dd>
      </template>

      <template v-if="ticket.updateEscalationAt">
        <dt>{{ $t('Next update') }}</dt>
        <dd><StudenthubTicketEscalation :value="ticket.updateEscalationAt" /></dd>
      </template>

      <template v-if="resolution?.result">
        <dt>{{ $t('Resolution') }}</dt>
        <dd class="font-bold" :style="{ color: resolution.result.color }">
          {{ $t(resolution.result.text) }}
        </dd>
      </template>

      <template v-else-if="resolution">
        <dt>{{ $t('Resolution due') }}</dt>
        <dd v-tooltip="resolution.dueTooltip" class="font-bold">{{ resolution.due }}</dd>

        <div
          class="sh-sla-box__bar"
          role="progressbar"
          :aria-label="$t('Time used until the resolution deadline')"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-valuenow="Math.round(resolution.share * 100)"
        >
          <span
            :style="{ width: `${resolution.share * 100}%`, backgroundColor: resolution.tone.text }"
          />
        </div>

        <dt>{{ $t('Time left') }}</dt>
        <dd
          class="font-bold tabular-nums"
          :style="resolution.overdue ? { color: resolution.tone.text } : undefined"
        >
          {{ resolution.timeLeft }}
        </dd>
      </template>
    </dl>
  </div>
</template>
