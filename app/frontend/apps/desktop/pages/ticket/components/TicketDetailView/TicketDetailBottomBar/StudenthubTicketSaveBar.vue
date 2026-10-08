<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import type { MacroById } from '#shared/entities/macro/types.ts'

import TicketScreenBehavior from '#desktop/pages/ticket/components/TicketDetailView/TicketScreenBehavior/TicketScreenBehavior.vue'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import TicketAgentUpdateButton from './TicketAgentUpdateButton.vue'
import TicketLiveUsers from './TicketLiveUsers.vue'
import TicketSharedDraftZoom from './TicketSharedDraftZoom.vue'

import type { Props } from './TicketDetailBottomBar.vue'

// Student Hub: the agents' save area at the foot of the panel column (design option B), in place
// of the bar across the bottom of the screen: who else is on the ticket and the shared draft, a
// note while changes are unsaved (with Discard), "After update" (Zammad's tab behaviour) and
// Update with its drafts and macros. The parts and what they do are Zammad's own
// (TicketDetailBottomBar); only the arrangement and the look are Student Hub's.
defineProps<Props>()

defineEmits<{
  submit: [MouseEvent]
  discard: [MouseEvent]
  'execute-macro': [MacroById]
}>()

const { ticket } = useTicketInformation()
</script>

<template>
  <section class="sh-save-bar print:hidden" :aria-label="$t('Save changes')">
    <div
      v-if="liveUserList?.length || ticket?.aiAgentRunning || hasAvailableDraft"
      class="sh-save-bar__people"
    >
      <TicketLiveUsers
        v-if="liveUserList?.length || ticket?.aiAgentRunning"
        :live-user-list="liveUserList"
      />
      <TicketSharedDraftZoom
        v-if="hasAvailableDraft"
        :form="form"
        :shared-draft-id="sharedDraftId"
      />
    </div>

    <template v-if="isTicketEditable">
      <p v-if="dirty" class="sh-save-bar__unsaved">
        <span class="sh-save-bar__dot" aria-hidden="true" />
        <span class="grow">{{ $t('Unsaved changes') }}</span>
        <button
          type="button"
          class="sh-save-bar__discard"
          :disabled="disabled"
          @click="$emit('discard', $event)"
        >
          {{ $t('Discard') }}
        </button>
      </p>

      <div class="sh-save-bar__actions">
        <div class="sh-save-bar__behavior">
          <span class="sh-save-bar__label">{{ $t('After update') }}</span>
          <TicketScreenBehavior />
        </div>

        <div class="sh-save-bar__update" :class="{ 'sh-save-bar__update--dirty': dirty }">
          <TicketAgentUpdateButton
            :ticket-id="ticketId"
            :form="form"
            :disabled="disabled"
            :group-id="groupId"
            :can-use-draft="canUseDraft"
            :shared-draft-id="sharedDraftId"
            @submit="$emit('submit', $event)"
            @execute-macro="$emit('execute-macro', $event)"
          />
        </div>
      </div>
    </template>
  </section>
</template>
