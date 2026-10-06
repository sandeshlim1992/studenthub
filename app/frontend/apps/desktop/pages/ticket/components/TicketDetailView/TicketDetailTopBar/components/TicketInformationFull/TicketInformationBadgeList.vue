<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useTicketView } from '#shared/entities/ticket/composables/useTicketView.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import CommonTicketEscalationIndicator from '#desktop/components/CommonTicketEscalationIndicator/CommonTicketEscalationIndicator.vue'
import ChecklistBadgeList from '#desktop/pages/ticket/components/TicketDetailView/TicketDetailTopBar/components/TicketInformationFull/TicketInformationBadgeList/ChecklistBadgeList.vue'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

const { ticket } = useTicketInformation()

const config = toRef(useApplicationStore(), 'config')

const { isTicketAgent } = useTicketView(ticket)

const isChecklistFeatureEnabled = computed(() => !!config.value.checklist)
</script>

<template>
  <div v-if="ticket" class="flex max-w-full flex-wrap items-center gap-2.5 text-nowrap *:h-7">
    <CommonTicketEscalationIndicator v-if="isTicketAgent" :ticket="ticket" has-popover />

    <!-- Student Hub: state and priority sit next to the title (TopBarHeaderFull) -->
    <span class="flex items-center text-sm text-gray-100 dark:text-neutral-400">
      <CommonDateTime :date-time="ticket.createdAt" absolute-format="date">
        <template #prefix>
          {{ $t('Created') }}
        </template>
      </CommonDateTime>
    </span>

    <ChecklistBadgeList v-if="isTicketAgent && isChecklistFeatureEnabled" />
  </div>
</template>
