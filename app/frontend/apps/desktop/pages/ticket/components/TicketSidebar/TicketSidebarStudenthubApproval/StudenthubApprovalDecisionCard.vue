<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'

import type { BadgeVariant } from '#shared/components/CommonBadge/types.ts'
import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaNode } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import { useTicketApproval } from './useTicketApproval.ts'

// Student Hub Ticket Approvals: under the last message, for the manager the ticket was sent
// to: who asked and why, then Approve / Deny (and the result once decided). The Approval tab
// keeps the full view (sending, withdrawing, history) for agents.

const session = useSessionStore()
const application = useApplicationStore()
const { ticket } = useTicketInformation()

const isApprover = computed(() => session.hasPermission('ticket.approver'))
const ticketId = computed(() => ticket.value?.internalId)
const approval = reactive(useTicketApproval(ticketId))

watch(
  () => [ticketId.value, ticket.value?.updatedAt, isApprover.value, application.config.ticket_approval],
  () => {
    if (ticketId.value && isApprover.value && application.config.ticket_approval) approval.load()
  },
  { immediate: true },
)

const myId = computed(() => (session.userId ? Number(getIdFromGraphQLId(session.userId)) : null))

const round = computed(() => {
  const current = approval.status?.current
  if (!approval.status?.enabled || !current || current.state === 'cancelled') return null
  if (current.approver?.id !== myId.value) return null
  return current
})

const isPending = computed(() => round.value?.state === 'pending' && !!approval.status?.can_decide)

const stateLabels: Record<string, string> = {
  pending: __('Waiting for your decision'),
  approved: __('Approved'),
  denied: __('Denied'),
}

const stateVariants: Record<string, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  denied: 'danger',
}

const { form: decisionForm, values: decisionValues, formReset: resetDecisionForm } = useForm()

const decisionSchema = [
  {
    type: 'textarea',
    name: 'comment',
    label: __('Comment'),
    help: __('Required when you deny.'),
    props: { rows: 2, maxlength: 5000 },
  },
] as FormSchemaNode[]

const { notify } = useNotifications()

const decide = async (decision: 'approve' | 'deny') => {
  const comment = String((decisionValues.value as { comment?: string }).comment ?? '')
  const ok =
    decision === 'approve' ? await approval.approve(comment) : await approval.deny(comment)
  if (!ok) return
  resetDecisionForm()
  notify({
    id: 'studenthub-ticket-approval',
    type: NotificationTypes.Success,
    message: decision === 'approve' ? __('Ticket approved.') : __('Ticket denied.'),
  })
}
</script>

<template>
  <article
    v-if="round"
    class="sh-approval-card"
    :data-state="round.state"
    :aria-label="$t('Approval request')"
    data-test-id="studenthub-approval-card"
  >
    <header class="flex flex-wrap items-center gap-2">
      <CommonIcon name="check2-circle" size="small" decorative class="text-current" />
      <h3 class="sh-approval-card__title">{{ $t('Approval request') }}</h3>
      <CommonBadge :variant="stateVariants[round.state]" size="medium">
        {{ $t(stateLabels[round.state]) }}
      </CommonBadge>
    </header>

    <p class="text-sm text-gray-100 dark:text-neutral-400">
      {{ $t('%s asked you to approve this ticket', round.requested_by?.name ?? '-') }} ·
      <CommonDateTime :date-time="round.requested_at" type="relative" />
    </p>

    <blockquote class="sh-approval-card__reason">{{ round.reason }}</blockquote>

    <CommonAlert v-if="approval.errorMessage" variant="danger">{{ approval.errorMessage }}</CommonAlert>

    <section v-if="isPending" class="flex flex-col gap-2" :aria-label="$t('Your decision')">
      <Form ref="decisionForm" :schema="decisionSchema" />
      <div class="flex gap-2">
        <CommonButton
          variant="submit"
          size="medium"
          prefix-icon="check2"
          :disabled="approval.isBusy"
          @click="decide('approve')"
        >
          {{ $t('Approve') }}
        </CommonButton>
        <CommonButton
          variant="danger"
          size="medium"
          prefix-icon="x-lg"
          :disabled="approval.isBusy"
          @click="decide('deny')"
        >
          {{ $t('Deny') }}
        </CommonButton>
      </div>
    </section>

    <p v-else-if="round.decided_at" class="text-sm">
      {{
        round.state === 'approved'
          ? $t('Approved by %s', round.decided_by?.name ?? '-')
          : $t('Denied by %s', round.decided_by?.name ?? '-')
      }}
      ·
      <CommonDateTime :date-time="round.decided_at" type="relative" />
      <span v-if="round.comment" class="mt-1 block whitespace-pre-wrap break-words text-gray-100 dark:text-neutral-400">{{
        round.comment
      }}</span>
    </p>
  </article>
</template>
