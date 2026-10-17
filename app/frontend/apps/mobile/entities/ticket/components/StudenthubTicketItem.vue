<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import CommonDateTime from '#shared/components/CommonDateTime/CommonDateTime.vue'

import {
  studenthubTicketStage,
  studenthubTicketStageLabel,
  type StudenthubTicketStage,
} from '../helpers/studenthubTicketStage.ts'

// Student Hub: one of a student's tickets as a card, with its title, last change, number and
// where it stands. The Tickets tab and the students' search list them.

interface StudenthubTicketItemTicket {
  internalId: number
  title: string
  number: string
  updatedAt: string
  state: { name: string; stateType: { name: string } }
}

const props = defineProps<{
  ticket: StudenthubTicketItemTicket
}>()

const stageChip: Record<StudenthubTicketStage, string> = {
  new: 'bg-gray-400 text-gray-100',
  progress: 'bg-blue-highlight text-blue',
  waiting: 'bg-yellow-highlight text-yellow',
  resolved: 'bg-green-highlight text-green',
  closed: 'bg-green-highlight text-green',
}

const stage = computed(() => studenthubTicketStage(props.ticket.state))
</script>

<template>
  <CommonLink
    :link="`/tickets/${ticket.internalId}`"
    class="flex flex-col gap-2 rounded-2xl bg-gray-500 px-4 py-3.5"
  >
    <span class="flex items-start justify-between gap-3">
      <span class="text-base leading-snug font-semibold">{{ ticket.title }}</span>
      <CommonDateTime
        class="shrink-0 pt-0.5 text-xs text-gray"
        :date-time="ticket.updatedAt"
        type="relative"
      />
    </span>
    <span class="flex items-center justify-between gap-3">
      <span class="text-sm text-gray">#{{ ticket.number }}</span>
      <span class="rounded-full px-2.5 py-1 text-xs font-bold" :class="stageChip[stage]">
        {{ $t(studenthubTicketStageLabel[stage]) }}
      </span>
    </span>
  </CommonLink>
</template>
