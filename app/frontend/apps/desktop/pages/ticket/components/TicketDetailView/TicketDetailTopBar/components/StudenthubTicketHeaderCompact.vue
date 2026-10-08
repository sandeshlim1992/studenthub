<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonInlineEdit from '#desktop/components/CommonInlineEdit/CommonInlineEdit.vue'
import StudenthubCampusBadge from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubCampusBadge.vue'
import StudenthubTicketPriority from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketPriority.vue'
import StudenthubTicketStateLabel from '#desktop/components/Ticket/StudenthubTicketCells/StudenthubTicketStateLabel.vue'
import HighlightMenu from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/HighlightMenu.vue'
import StudenthubTicketHeaderActions from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/StudenthubTicketHeaderActions.vue'

import { useTopBarHeader } from './useTopBarHeader.ts'

// Student Hub: the agents' ticket header with the queue beside the ticket (design option B), in
// two rows: number, campus, state and priority with the actions on the right, then the title over
// the full width (the conversation column is narrow next to the queue and the panels). The
// student and the dates are in the queue and the Ticket panel; Reply and Add note in the reply
// bar under the messages.
const {
  ticket,
  ticketNumber,
  isTicketAgent,
  isTicketEditable,
  copyTicketNumberToClipboard,
  isUpdatingTitle,
  updateTitle,
} = useTopBarHeader()

const campus = () =>
  ticket.value?.objectAttributeValues?.find((entry) => entry.attribute.name === 'campus')?.value
</script>

<template>
  <header v-if="ticket" class="sh-ticket-header sh-ticket-header--compact">
    <div class="sh-ticket-header__meta">
      <span v-if="ticketNumber" class="sh-ticket-number">#{{ ticketNumber }}</span>
      <CommonButton
        v-if="ticketNumber"
        v-tooltip="$t('Copy ticket number')"
        variant="secondary"
        icon="files"
        size="small"
        class="print:hidden"
        @click="copyTicketNumberToClipboard"
      />
      <StudenthubCampusBadge v-if="campus()" compact class="shrink-0" :value="campus()" />
      <StudenthubTicketStateLabel :state="ticket.state" class="text-sm!" />
      <StudenthubTicketPriority
        v-if="isTicketAgent && ticket.priority"
        :priority="ticket.priority"
      />
    </div>

    <div class="sh-ticket-header__side print:hidden">
      <HighlightMenu v-if="isTicketAgent && isTicketEditable" />
      <StudenthubTicketHeaderActions compact />
    </div>

    <div class="sh-ticket-header__title">
      <CommonInlineEdit
        v-model:editing="isUpdatingTitle"
        size="large"
        required
        :disabled="!ticket.policy.update"
        :value="ticket.title"
        max-length="255"
        :classes="{
          label: 'dark:text-white font-semibold',
          input: 'dark:text-white font-semibold',
        }"
        :label-attrs="{
          role: 'heading',
          'aria-level': '2',
        }"
        :label="$t('Edit ticket title')"
        @submit-edit="updateTitle"
      />
    </div>
  </header>
</template>
