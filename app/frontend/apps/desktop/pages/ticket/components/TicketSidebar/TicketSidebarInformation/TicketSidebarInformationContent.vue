<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef, useTemplateRef, watch } from 'vue'

import { useForm } from '#shared/components/Form/useForm.ts'
import { useTicketView } from '#shared/entities/ticket/composables/useTicketView.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import type { ObjectLike } from '#shared/types/utils.ts'

import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import CommonSectionCollapse from '#desktop/components/CommonSectionCollapse/CommonSectionCollapse.vue'
import { useStudenthubTicketDetailsMode } from '#desktop/pages/ticket/composables/useStudenthubTicketDetailsMode.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import { type TicketSidebarContentProps } from '#desktop/pages/ticket/types/sidebar.ts'

import {
  TICKET_HISTORY_FLYOUT_NAME,
  useTicketHistory,
} from '../../TicketDetailView/actions/useTicketHistory.ts'
import TicketSidebarContent from '../TicketSidebarContent.vue'

import StudenthubTicketDetailsList from './TicketSidebarInformationContent/StudenthubTicketDetailsList.vue'
import StudenthubTicketSlaBox from './TicketSidebarInformationContent/StudenthubTicketSlaBox.vue'
import TicketAccountedTime from './TicketSidebarInformationContent/TicketAccountedTime.vue'
import TicketAIKnowledgeBaseAnswers from './TicketSidebarInformationContent/TicketAIKnowledgeBaseAnswers.vue'
import TicketAISuggestedKnowledgeBaseAnswers from './TicketSidebarInformationContent/TicketAISuggestedKnowledgeBaseAnswers.vue'
import TicketLinks from './TicketSidebarInformationContent/TicketLinks.vue'
import TicketSubscribers from './TicketSidebarInformationContent/TicketSubscribers.vue'
import TicketTags from './TicketSidebarInformationContent/TicketTags.vue'

const props = defineProps<TicketSidebarContentProps>()

const persistentStates = defineModel<ObjectLike>({ required: true })

const { ticket, ticketInternalId, form } = useTicketInformation()

const ticketLinksInstance = useTemplateRef('ticket-links')

const { isTicketAgent, isTicketEditable } = useTicketView(ticket)

// Student Hub: Details is a read-only list for agents; "Edit" shows Zammad's form (which stays
// mounted while hidden, so Update and the header actions keep working).
const { isEditingDetails } = useStudenthubTicketDetailsMode(ticketInternalId)
const showDetailsList = computed(() => isTicketAgent.value && !isEditingDetails.value)

// Open the form when Update is refused because a field is missing or wrong.
const { isSubmitted } = useForm(form)
watch(isSubmitted, (submitted) => {
  if (!submitted || !isTicketAgent.value) return
  if (form?.value?.findNodeByName('ticket')?.context?.state.valid === false)
    isEditingDetails.value = true
})
const config = toRef(useApplicationStore(), 'config')
const { hasPermission } = useSessionStore()

const showAIKnowledgeBaseDraft = computed(
  () =>
    isTicketAgent.value &&
    hasPermission('knowledge_base.editor') &&
    config.value.kb_active &&
    config.value.ai_provider &&
    config.value.ai_assistance_kb_answer_from_ticket_generation,
)

const showAISuggestedKnowledgeBaseAnswers = computed(
  () =>
    isTicketAgent.value &&
    hasPermission('knowledge_base.*') &&
    config.value.kb_active &&
    config.value.ai_provider,
)

const showRelatedKnowledge = computed(
  () => showAIKnowledgeBaseDraft.value || showAISuggestedKnowledgeBaseAnswers.value,
)

const ticketMergeFlyoutName = 'ticket-merge'
const ticketChangeCustomerFlyoutName = 'ticket-change-customer'

const { openTicketHistoryFlyout } = useTicketHistory()

const { open: openTicketMergeFlyout } = useFlyout({
  name: ticketMergeFlyoutName,
  component: () =>
    import('#desktop/pages/ticket/components/TicketDetailView/actions/TicketMerge/TicketMergeFlyout.vue'),
})

const { open: openChangeCustomerFlyout } = useFlyout({
  name: ticketChangeCustomerFlyoutName,
  component: () =>
    import('#desktop/pages/ticket/components/TicketDetailView/actions/TicketChangeCustomer/TicketChangeCustomerFlyout.vue'),
})

// :TODO find a way to provide the ticket via prop
const actions = computed<MenuItem[]>(() => [
  {
    key: TICKET_HISTORY_FLYOUT_NAME,
    label: __('History'),
    icon: 'clock-history',
    show: () => isTicketAgent.value,
    onClick: () => openTicketHistoryFlyout(ticket.value!.id),
  },
  {
    key: ticketMergeFlyoutName,
    label: __('Merge'),
    icon: 'merge',
    show: () => isTicketAgent.value && isTicketEditable.value,
    onClick: () =>
      openTicketMergeFlyout({
        ticket,
        currentTaskbarTabId: props.context.currentTaskbarTabId,
      }),
  },
  {
    key: ticketChangeCustomerFlyoutName,
    label: __('Change customer'),
    icon: 'user',
    show: () => isTicketAgent.value && isTicketEditable.value,
    onClick: () =>
      openChangeCustomerFlyout({
        ticket,
      }),
  },
])
</script>

<template>
  <TicketSidebarContent
    v-model="persistentStates.scrollPosition"
    :title="sidebarPlugin.title"
    :icon="sidebarPlugin.icon"
    :actions="actions"
  >
    <CommonSectionCollapse
      id="ticket-attributes"
      v-model="persistentStates.collapseAttributes"
      :title="__('Details')"
    >
      <template #title="{ title, size }">
        <CommonLabel class="grow text-current! select-none" :size="size" tag="h3">
          {{ $t(title) }}
        </CommonLabel>
        <button
          v-if="isTicketAgent && isTicketEditable"
          type="button"
          class="sh-details-edit"
          :aria-pressed="isEditingDetails"
          @click.stop="isEditingDetails = !isEditingDetails"
          @keydown.enter.stop
        >
          {{ isEditingDetails ? $t('Done') : $t('Edit') }}
        </button>
      </template>

      <StudenthubTicketDetailsList v-if="showDetailsList" />
      <div
        v-show="!showDetailsList"
        id="ticketEditAttributeForm"
        class="sh-ticket-edit-form"
        data-test-id="ticket-edit-attribute-form"
      />
    </CommonSectionCollapse>

    <!-- Student Hub: SLA card right below the ticket details -->
    <CommonSectionCollapse
      v-if="isTicketAgent && ticket"
      id="ticket-sla"
      v-model="persistentStates.collapseSla"
      :title="__('SLA')"
    >
      <StudenthubTicketSlaBox :ticket="ticket" />
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="isTicketAgent && (isTicketEditable || ticket?.tags?.length)"
      id="ticket-tags"
      v-model="persistentStates.collapseTags"
      :title="__('Tags')"
    >
      <TicketTags :ticket="ticket" :is-ticket-editable="isTicketEditable" />
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="isTicketAgent"
      v-show="isTicketEditable || ticketLinksInstance?.hasLinks"
      id="ticket-links"
      v-model="persistentStates.collapseLinks"
      :title="__('Related tickets')"
    >
      <TicketLinks ref="ticket-links" :ticket="ticket" :is-ticket-editable="isTicketEditable" />
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="showRelatedKnowledge"
      id="ticket-ai-knowledge-base-answers"
      v-model="persistentStates.collapseKnowledgeBase"
      :title="__('Related knowledge')"
    >
      <div class="flex flex-col gap-3">
        <TicketAISuggestedKnowledgeBaseAnswers v-if="showAISuggestedKnowledgeBaseAnswers" />
        <TicketAIKnowledgeBaseAnswers v-if="showAIKnowledgeBaseDraft" />
      </div>
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="ticket?.timeUnit && isTicketAgent"
      id="ticket-time-accounting"
      v-model="persistentStates.collapseTimeAccounting"
      :title="__('Accounted time')"
    >
      <TicketAccountedTime :ticket="ticket!" />
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="isTicketAgent"
      id="ticket-subscribers"
      v-model="persistentStates.collapseSubscribers"
      :title="__('Subscribers')"
    >
      <TicketSubscribers :ticket="ticket" />
    </CommonSectionCollapse>
  </TicketSidebarContent>
</template>
