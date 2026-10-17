<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import {
  isStudenthubTicketDone,
  studenthubTicketStage,
  studenthubTicketStageLabel,
  type StudenthubTicketStage,
} from '#mobile/entities/ticket/helpers/studenthubTicketStage.ts'

// Student Hub: the student's latest ticket on Home, the newest one they raised, with how far it
// has come (design C3). The server picks it (Service::StudenthubCustomerTicket::Latest), as the My
// Tickets view may be grouped and only gives the first page here.

interface LatestTicket {
  id: number
  number: string
  title: string
  updated_at: string
  state: string
  state_type: string
}

const newest = ref<LatestTicket | null>(null)

onMounted(async () => {
  try {
    newest.value = await studenthubApi<LatestTicket | null>(
      '/api/v1/studenthub/customer_tickets/latest',
    )
  } catch {
    // Home works without it.
  }
})

const currentStep = (stage: StudenthubTicketStage) => {
  if (isStudenthubTicketDone(stage)) return 2
  if (stage === 'new') return 0
  return 1
}

const latest = computed(() => {
  const ticket = newest.value
  if (!ticket) return

  const stage = studenthubTicketStage({
    name: ticket.state,
    stateType: { name: ticket.state_type },
  })
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
    :link="`/tickets/${latest.ticket.id}`"
    class="flex flex-col gap-3.5 rounded-[20px] bg-blue p-4"
  >
    <span class="flex items-baseline justify-between gap-3 text-sm text-white/80">
      <span>{{ $t('Your latest ticket') }} · #{{ latest.ticket.number }}</span>
      <CommonDateTime class="text-xs" :date-time="latest.ticket.updated_at" type="relative" />
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
