<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick } from 'vue'

import { useForm } from '#shared/components/Form/useForm.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'
import { useStudenthubTicketDetailsMode } from '#desktop/pages/ticket/composables/useStudenthubTicketDetailsMode.ts'
import { useStudenthubTicketReply } from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import StudenthubHeaderMenuButton from './StudenthubHeaderMenuButton.vue'

// Student Hub: Halo-style actions in the ticket header. They reuse what Zammad already has:
// Reply = the reply action of the latest customer message, Add note = an internal note,
// Assign / Change status fill the Owner and State fields (saved with Update, like every other
// change), Merge opens Zammad's merge dialog, Close sets a closed state and saves at once.
// Students (customers) only get Reply.
// Compact (agents' compact header, design option B): Reply and Add note are in the reply bar
// under the messages; Assign and Change status are icon buttons, Merge is under ⋯.
interface Props {
  compact?: boolean
}

defineProps<Props>()

const { ticket, ticketInternalId, form, isTicketEditable } = useTicketInformation()
const { reply, addNote, isAgent } = useStudenthubTicketReply()
const session = useSessionStore()

// ---- fields of the ticket form (sidebar) ----

// The options come from the ticket form, which loads after the header: re-read them once the
// form has settled and whenever the state changes (core workflows can change the choice).
const { values, updateFieldValues, formSubmit } = useForm(form)

const stateOptions = computed(() => {
  if (!form?.value?.formInitialSettled) return []
  void values.value.state_id

  return (form?.value?.getNodeByName('state_id')?.props.options ?? []) as {
    value: number
    label: string
  }[]
})

// "6. Closed" and the like, not "pending close".
const closedState = computed(() =>
  stateOptions.value.find(
    (option) => /\bclosed?\b/i.test(option.label) && !/pending/i.test(option.label),
  ),
)

const setState = (stateId: number) => updateFieldValues({ state_id: stateId })

// Like Update: if a required field is empty, the Details form opens and says which.
const closeTicket = async () => {
  if (!closedState.value) return

  setState(closedState.value.value)
  await nextTick()
  formSubmit()
}

const statusItems = computed<MenuItem[]>(() =>
  stateOptions.value.map((option) => ({
    key: `state-${option.value}`,
    label: option.label,
    onClick: () => setState(option.value),
  })),
)

const { isEditingDetails } = useStudenthubTicketDetailsMode(ticketInternalId)

// The owner field is in the Details form, which is hidden while Details shows the list.
const focusOwnerField = async () => {
  isEditingDetails.value = true
  await nextTick()

  const input = document.querySelector<HTMLElement>(
    `#${CSS.escape(form?.value?.getNodeByName('owner_id')?.props.id ?? '')}`,
  )
  input?.scrollIntoView({ block: 'center' })
  input?.focus()
  input?.click()
}

const assignItems = computed<MenuItem[]>(() => [
  {
    key: 'assign-me',
    label: __('Assign to me'),
    icon: 'user',
    onClick: () => updateFieldValues({ owner_id: Number(getIdFromGraphQLId(session.userId)) }),
  },
  {
    key: 'assign-other',
    label: __('Choose someone else…'),
    onClick: focusOwnerField,
  },
])

const { open: openMergeFlyout } = useFlyout({
  name: 'ticket-merge',
  component: () =>
    import('#desktop/pages/ticket/components/TicketDetailView/actions/TicketMerge/TicketMergeFlyout.vue'),
})

// The tab id lets Zammad close this tab after the merge.
const merge = () =>
  openMergeFlyout({
    ticket,
    currentTaskbarTabId: useUserCurrentTaskbarTabsStore().activeTaskbarTabId,
  })

const moreItems = computed<MenuItem[]>(() => [
  { key: 'merge', label: __('Merge'), icon: 'merge', onClick: merge },
])
</script>

<template>
  <div
    v-if="ticket && isTicketEditable && compact && isAgent"
    class="flex items-center gap-1.5 print:hidden"
    role="toolbar"
    :aria-label="$t('Ticket header actions')"
  >
    <StudenthubHeaderMenuButton
      :label="__('Assign')"
      icon="user-add"
      icon-only
      :items="assignItems"
    />
    <StudenthubHeaderMenuButton
      v-if="statusItems.length"
      :label="__('Change status')"
      icon="arrow-repeat"
      icon-only
      :items="statusItems"
    />
    <StudenthubHeaderMenuButton
      :label="__('More actions')"
      icon="three-dots-vertical"
      icon-only
      :items="moreItems"
    />
    <button
      v-if="closedState"
      type="button"
      class="sh-header-action sh-header-action--close"
      @click="closeTicket"
    >
      <CommonIcon name="check2-circle" size="xs" decorative />
      {{ $t('Close') }}
    </button>
  </div>
  <div
    v-else-if="ticket && isTicketEditable && !compact"
    class="flex flex-wrap items-center gap-2 print:hidden"
    role="toolbar"
    :aria-label="$t('Ticket header actions')"
  >
    <button type="button" class="sh-header-action sh-header-action--primary" @click="reply">
      <CommonIcon name="reply" size="xs" decorative />
      {{ $t('Reply') }}
    </button>
    <button v-if="isAgent" type="button" class="sh-header-action" @click="addNote">
      <CommonIcon name="pencil-square" size="xs" decorative />
      {{ $t('Add note') }}
    </button>
    <template v-if="isAgent">
      <StudenthubHeaderMenuButton :label="__('Assign')" icon="user" :items="assignItems" />
      <StudenthubHeaderMenuButton
        v-if="statusItems.length"
        :label="__('Change status')"
        :items="statusItems"
      />
      <button type="button" class="sh-header-action" @click="merge">
        <CommonIcon name="merge" size="xs" decorative />
        {{ $t('Merge') }}
      </button>
      <button
        v-if="closedState"
        type="button"
        class="sh-header-action sh-header-action--close"
        @click="closeTicket"
      >
        <CommonIcon name="check2-circle" size="xs" decorative />
        {{ $t('Close') }}
      </button>
    </template>
  </div>
</template>
