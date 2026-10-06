<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, inject, nextTick } from 'vue'

import { useForm } from '#shared/components/Form/useForm.ts'
import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import type { TicketArticle } from '#shared/entities/ticket/types.ts'
import { createArticleActions } from '#shared/entities/ticket-article/action/plugins/index.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { edgesToArray } from '#shared/utils/helpers.ts'

import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'
import { ARTICLES_INFORMATION_KEY } from '#desktop/pages/ticket/composables/useArticleContext.ts'
import { useStudenthubTicketDetailsMode } from '#desktop/pages/ticket/composables/useStudenthubTicketDetailsMode.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import StudenthubHeaderMenuButton from './StudenthubHeaderMenuButton.vue'

// Student Hub: Halo-style actions in the ticket header. They reuse what Zammad already has:
// Reply = the reply action of the latest customer message, Add note = an internal note,
// Assign / Change status fill the Owner and State fields (saved with Update, like every other
// change), Merge opens Zammad's merge dialog, Close sets a closed state and saves at once.
// Students (customers) only get Reply.

const { ticket, ticketInternalId, form, isTicketEditable, showTicketArticleReplyForm } =
  useTicketInformation()
// The article list provides this; the default keeps the header usable without it.
const articleContext = inject(ARTICLES_INFORMATION_KEY, null)
const { openReplyForm, getNewArticleBody } = useTicketArticleReplyAction(form, showTicketArticleReplyForm)
const session = useSessionStore()
const isAgent = computed(() => session.hasPermission('ticket.agent'))

const articles = computed<TicketArticle[]>(() => {
  const data = articleContext?.articles.value
  if (!data) return []
  return [...edgesToArray(data.firstArticles), ...edgesToArray(data.articles)] as TicketArticle[]
})

// The newest public message from the customer, otherwise the newest public message.
const replyTarget = computed(() => {
  const visible = articles.value.filter((article) => !article.internal)
  return (
    visible.findLast((article) => article.sender?.name === 'Customer') ?? visible.at(-1) ?? null
  )
})

const replyAction = computed(() => {
  if (!ticket.value || !replyTarget.value) return null
  return (
    createArticleActions(ticket.value, replyTarget.value, 'desktop', {
      onDispose: () => {},
      recalculate: () => {},
    }).find((action) => action.name.endsWith('-reply') && action.perform) ?? null
  )
})

const reply = () => {
  if (!ticket.value) return

  if (replyAction.value && replyTarget.value) {
    replyAction.value.perform!(ticket.value, replyTarget.value, {
      formId: form?.value?.formId ?? '',
      openReplyForm,
      getNewArticleBody,
    })
    return
  }

  openReplyForm({ articleType: isAgent.value ? 'email' : 'web', internal: false })
}

const addNote = () => openReplyForm({ articleType: 'note', internal: true })

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
  stateOptions.value.find((option) => /\bclosed?\b/i.test(option.label) && !/pending/i.test(option.label)),
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
  openMergeFlyout({ ticket, currentTaskbarTabId: useUserCurrentTaskbarTabsStore().activeTaskbarTabId })
</script>

<template>
  <div
    v-if="ticket && isTicketEditable"
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
