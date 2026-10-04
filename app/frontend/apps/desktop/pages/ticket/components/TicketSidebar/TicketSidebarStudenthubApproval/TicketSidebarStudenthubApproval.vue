<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, reactive, watch } from 'vue'

import { usePersistentStates } from '#desktop/pages/ticket/composables/usePersistentStates.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import {
  type TicketSidebarProps,
  type TicketSidebarEmits,
  TicketSidebarButtonBadgeType,
  type TicketSidebarButtonBadgeDetails,
} from '#desktop/pages/ticket/types/sidebar.ts'

import TicketSidebarWrapper from '../TicketSidebarWrapper.vue'

import TicketSidebarStudenthubApprovalContent from './TicketSidebarStudenthubApprovalContent.vue'
import { useTicketApproval } from './useTicketApproval.ts'

defineProps<TicketSidebarProps>()

const emit = defineEmits<TicketSidebarEmits>()

const { persistentStates } = usePersistentStates()
const { ticket } = useTicketInformation()

const ticketId = computed(() => ticket.value?.internalId)
const approval = reactive(useTicketApproval(ticketId))

// Reload whenever the ticket changes, e.g. when the manager decides while the agent has it open.
watch(
  () => [ticketId.value, ticket.value?.updatedAt],
  () => {
    if (ticketId.value) approval.load()
  },
  { immediate: true },
)

const badge = computed<TicketSidebarButtonBadgeDetails | undefined>(() => {
  if (!approval.status?.can_decide) return

  return {
    type: TicketSidebarButtonBadgeType.Alarming,
    value: 1,
    label: __('Waiting for your decision'),
  }
})

onMounted(() => {
  emit('show')
})
</script>

<template>
  <TicketSidebarWrapper
    :key="sidebar"
    :sidebar="sidebar"
    :sidebar-plugin="sidebarPlugin"
    :selected="selected"
    :badge="badge"
  >
    <TicketSidebarStudenthubApprovalContent
      v-model="persistentStates"
      :context="context"
      :sidebar-plugin="sidebarPlugin"
      :approval="approval"
    />
  </TicketSidebarWrapper>
</template>
