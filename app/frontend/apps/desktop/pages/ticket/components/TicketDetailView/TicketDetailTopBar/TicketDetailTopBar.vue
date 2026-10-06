<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import CommonAlert from '#shared/components/CommonAlert/CommonAlert.vue'
import { useTicketChannel } from '#shared/entities/ticket/composables/useTicketChannel.ts'
import { useTicketView } from '#shared/entities/ticket/composables/useTicketView.ts'

import { useStickyTopCalculator } from '#desktop/components/Form/fields/FieldEditor/useStickyTopCalculator.ts'
import TopBarHeaderFull from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/TopBarHeaderFull.vue'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

interface Props {
  contentContainerElement: HTMLDivElement | null
}

defineProps<Props>()

const { ticket } = useTicketInformation()
const { isTicketAgent, isTicketEditable } = useTicketView(ticket)
const { hasChannelAlert, channelAlert } = useTicketChannel(ticket)

const shouldShowChannelAlert = computed(
  () => isTicketAgent.value && isTicketEditable.value && hasChannelAlert.value,
)

const headerBaseClasses =
  'border-b border-neutral-100 dark:border-gray-900 bg-neutral-50 dark:bg-gray-500'

const alertBaseClasses = 'rounded-none px-14 md:grid-cols-none md:justify-center'

// Student Hub: no compact header docks at the top while scrolling (the top bar already shows
// "Tickets / <group> / Ticket#…"); the full header scrolls away with the conversation. Nothing
// covers the top of the content, so sticky elements below (e.g. the editor toolbar) start at 0.
useStickyTopCalculator(ref(0), { offset: -1 }) // avoid joining with the top bar bottom border
</script>

<template>
  <div class="relative w-full" data-test-id="ticket-detail-top-bar-full-details">
    <TopBarHeaderFull :class="[headerBaseClasses, { 'p-3': shouldShowChannelAlert }]" />
    <CommonAlert
      v-if="shouldShowChannelAlert"
      class="print:hidden"
      :class="alertBaseClasses"
      :variant="channelAlert?.variant"
    >
      {{ $t(channelAlert?.text, channelAlert?.textPlaceholder) }}
    </CommonAlert>
  </div>
</template>
