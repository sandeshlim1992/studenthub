<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { TicketById } from '#shared/entities/ticket/types.ts'
import { STUDENTHUB_CUSTOMER_TICKET_STATUS } from '#shared/utils/studenthubCustomerTicket.ts'

import CommonBackButton from '#mobile/components/CommonBackButton/CommonBackButton.vue'

import { useStudenthubCustomerTicket } from '../../composable/useStudenthubCustomerTicket.ts'

// Student Hub: the student's chat header, in place of Zammad's header and title block. The title
// and the info button open the ticket's information.
interface Props {
  ticket: TicketById
}

const props = defineProps<Props>()

const { overview } = useStudenthubCustomerTicket()

const informationLink = computed(() => `/tickets/${props.ticket.internalId}/information`)

const status = computed(() => {
  const stage = overview.value?.progress.stage
  if (!stage) return props.ticket.state.name

  return STUDENTHUB_CUSTOMER_TICKET_STATUS[stage].label
})
</script>

<template>
  <header
    class="flex items-center gap-1 border-b-[0.5px] border-white/10 bg-gray-600 px-2 py-2"
    data-test-id="studenthub-chat-header"
  >
    <CommonBackButton class="shrink-0 px-2" fallback="/" :ignore="[informationLink]" />
    <CommonLink class="flex min-w-0 flex-1 flex-col gap-0.5 py-1" :link="informationLink">
      <h1 class="truncate text-base leading-5 font-bold">{{ ticket.title }}</h1>
      <p class="truncate text-xs leading-4 text-gray">
        #{{ ticket.number }}
        <template v-if="ticket.organization">· {{ ticket.organization.name }}</template>
        · {{ $t(status) }}
      </p>
    </CommonLink>
    <CommonLink
      class="flex size-11 shrink-0 items-center justify-center"
      :link="informationLink"
      :aria-label="$t('Ticket details')"
    >
      <CommonIcon name="info" size="base" decorative />
    </CommonLink>
  </header>
</template>
