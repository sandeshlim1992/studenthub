<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'

import { useStudenthubMyTickets } from '#mobile/entities/ticket/composables/useStudenthubMyTickets.ts'
import {
  isStudenthubTicketDone,
  studenthubTicketStage,
  studenthubTicketStageLabel,
  type StudenthubTicketStage,
} from '#mobile/entities/ticket/helpers/studenthubTicketStage.ts'

// Student Hub: the student's latest ticket on Home, with how far it has come (design C3).

const { tickets } = useStudenthubMyTickets()

const currentStep = (stage: StudenthubTicketStage) => {
  if (isStudenthubTicketDone(stage)) return 2
  if (stage === 'new') return 0
  return 1
}

const latest = computed(() => {
  const [ticket] = tickets.value
  if (!ticket) return

  const stage = studenthubTicketStage(ticket.state)
  const current = currentStep(stage)
  const steps = [
    __('Received'),
    stage === 'waiting' ? studenthubTicketStageLabel.waiting : __('In progress'),
    stage === 'closed' ? studenthubTicketStageLabel.closed : __('Resolved'),
  ]

  return { ticket, steps, current }
})
</script>

<template>
  <CommonLink
    v-if="latest"
    :link="`/tickets/${latest.ticket.internalId}`"
    class="flex flex-col gap-3.5 rounded-[20px] bg-blue p-4"
  >
    <span class="flex items-baseline justify-between gap-3 text-sm text-white/80">
      <span>{{ $t('Your latest ticket') }} · #{{ latest.ticket.number }}</span>
      <CommonDateTime class="text-xs" :date-time="latest.ticket.updatedAt" type="relative" />
    </span>
    <span class="text-lg font-bold">{{ latest.ticket.title }}</span>
    <ol class="grid grid-cols-3 gap-1.5">
      <li
        v-for="(step, index) in latest.steps"
        :key="step"
        class="flex flex-col gap-1.5 text-xs"
        :class="{ 'text-white/70': index > latest.current, 'font-bold': index === latest.current }"
        :aria-current="index === latest.current ? 'step' : undefined"
      >
        <span
          class="h-1.5 rounded-full"
          :class="index <= latest.current ? 'bg-white' : 'bg-white/25'"
        />
        {{ $t(step) }}
      </li>
    </ol>
  </CommonLink>
</template>
