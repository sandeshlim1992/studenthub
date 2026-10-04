<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, type UnwrapNestedRefs } from 'vue'

import type { BadgeVariant } from '#shared/components/CommonBadge/types.ts'
import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaNode, FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import type { ObjectLike } from '#shared/types/utils.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import type { TicketSidebarContentProps } from '#desktop/pages/ticket/types/sidebar.ts'

import TicketSidebarContent from '../TicketSidebarContent.vue'

import type { ApprovalRound, TicketApproval } from './useTicketApproval.ts'

interface Props extends TicketSidebarContentProps {
  approval: UnwrapNestedRefs<TicketApproval>
}

const props = defineProps<Props>()

const persistentStates = defineModel<ObjectLike>({ required: true })

const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()

const { form: requestForm, formNodeId: requestFormNodeId, formReset: resetRequestForm } = useForm()
const { form: decisionForm, values: decisionValues, formReset: resetDecisionForm } = useForm()

const status = computed(() => props.approval.status)

const stateLabels: Record<string, string> = {
  pending: __('Waiting for approval'),
  approved: __('Approved'),
  denied: __('Denied'),
  cancelled: __('Withdrawn'),
}

const stateVariants: Record<string, BadgeVariant> = {
  pending: 'warning',
  approved: 'success',
  denied: 'danger',
  cancelled: 'neutral',
}

// Zammad's select treats "disabled" options as expandable groups, so managers who
// can't open this ticket are left out of the list and named in a note instead.
const selectableManagers = computed(() =>
  (status.value?.managers ?? []).filter((manager) => manager.can_open_ticket),
)
const blockedManagerNames = computed(() =>
  (status.value?.managers ?? [])
    .filter((manager) => !manager.can_open_ticket)
    .map((manager) => manager.name)
    .join(', '),
)

const requestSchema = computed(
  () =>
    [
      {
        type: 'select',
        name: 'approver_id',
        label: __('Manager'),
        required: true,
        props: {
          noOptionsLabelTranslation: true,
          options: selectableManagers.value.map((manager) => ({
            value: manager.id,
            label: manager.name,
          })),
        },
      },
      {
        type: 'textarea',
        name: 'reason',
        label: __('Reason'),
        required: true,
        props: { rows: 3, maxlength: 5000 },
      },
    ] as FormSchemaNode[],
)

const decisionSchema = [
  {
    type: 'textarea',
    name: 'comment',
    label: __('Comment'),
    help: __('Required when you deny.'),
    props: { rows: 3, maxlength: 5000 },
  },
] as FormSchemaNode[]

const done = (message: string) => {
  notify({ id: 'studenthub-ticket-approval', type: NotificationTypes.Success, message })
}

const sendForApproval = async (data: FormSubmitData<{ approver_id: number | string; reason: string }>) => {
  const ok = await props.approval.sendForApproval(Number(data.approver_id), data.reason)
  if (!ok) return
  resetRequestForm()
  done(__('Sent for approval.'))
}

const decide = async (decision: 'approve' | 'deny') => {
  const comment = String((decisionValues.value as { comment?: string }).comment ?? '')
  const ok = decision === 'approve' ? await props.approval.approve(comment) : await props.approval.deny(comment)
  if (!ok) return
  resetDecisionForm()
  done(decision === 'approve' ? __('Ticket approved.') : __('Ticket denied.'))
}

const withdraw = async () => {
  const confirmed = await waitForConfirmation(__('Withdraw this approval request?'), {
    buttonLabel: __('Withdraw'),
    buttonVariant: 'danger',
  })
  if (!confirmed) return
  if (await props.approval.withdraw()) done(__('Approval request withdrawn.'))
}

const roundTime = (round: ApprovalRound) => round.decided_at || round.requested_at
</script>

<template>
  <TicketSidebarContent
    v-model="persistentStates.scrollPosition"
    :title="sidebarPlugin.title"
    :icon="sidebarPlugin.icon"
  >
    <CommonLoader :loading="approval.isLoading && !status">
      <div class="flex flex-col gap-4">
        <CommonAlert v-if="approval.errorMessage" variant="danger">{{ approval.errorMessage }}</CommonAlert>

        <template v-if="status">
          <div v-if="status.state" class="flex items-center gap-2">
            <CommonBadge :variant="stateVariants[status.state]" size="medium">
              {{ $t(stateLabels[status.state]) }}
            </CommonBadge>
          </div>

          <dl
            v-if="status.current"
            class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm text-gray-100 dark:text-neutral-400"
          >
            <dt>{{ $t('Sent to') }}</dt>
            <dd class="text-black dark:text-white">{{ status.current.approver?.name }}</dd>
            <dt>{{ $t('Sent by') }}</dt>
            <dd class="text-black dark:text-white">
              {{ status.current.requested_by?.name }} ·
              <CommonDateTime :date-time="status.current.requested_at" type="relative" />
            </dd>
            <dt>{{ $t('Reason') }}</dt>
            <dd class="whitespace-pre-wrap break-words text-black dark:text-white">{{ status.current.reason }}</dd>
          </dl>

          <section v-if="status.can_decide" class="flex flex-col gap-2" :aria-label="$t('Your decision')">
            <Form ref="decisionForm" :schema="decisionSchema" />
            <div class="flex gap-2">
              <CommonButton variant="submit" size="medium" :disabled="approval.isBusy" @click="decide('approve')">
                {{ $t('Approve') }}
              </CommonButton>
              <CommonButton variant="danger" size="medium" :disabled="approval.isBusy" @click="decide('deny')">
                {{ $t('Deny') }}
              </CommonButton>
            </div>
          </section>

          <div v-if="status.can_cancel">
            <CommonButton variant="remove" :disabled="approval.isBusy" @click="withdraw">
              {{ $t('Withdraw request') }}
            </CommonButton>
          </div>

          <section v-if="status.can_request" class="flex flex-col gap-2" :aria-label="$t('Send for approval')">
            <CommonLabel v-if="status.state === 'approved' || status.state === 'denied'" size="small">
              {{ $t('You can send it for approval again.') }}
            </CommonLabel>
            <CommonLabel v-if="status.managers.length === 0" size="small">
              {{ $t('There are no managers yet. Give someone the Managers role first.') }}
            </CommonLabel>
            <CommonLabel v-else-if="selectableManagers.length === 0" size="small">
              {{
                $t(
                  "None of the managers can open this ticket (%s). Give the Managers role read access to this ticket's group.",
                  blockedManagerNames,
                )
              }}
            </CommonLabel>
            <template v-else>
              <Form
                ref="requestForm"
                :schema="requestSchema"
                @submit="sendForApproval($event as FormSubmitData<{ approver_id: number | string; reason: string }>)"
              />
              <CommonLabel v-if="blockedManagerNames" size="small" class="text-gray-100 dark:text-neutral-400">
                {{ $t("Not listed because they can't open this ticket: %s", blockedManagerNames) }}
              </CommonLabel>
              <div>
                <CommonButton
                  type="submit"
                  variant="submit"
                  size="medium"
                  :form="requestFormNodeId"
                  :disabled="approval.isBusy"
                >
                  {{ $t('Send for approval') }}
                </CommonButton>
              </div>
            </template>
          </section>

          <section v-if="status.history.length" class="flex flex-col gap-2 border-t border-neutral-100 pt-3 dark:border-gray-900">
            <CommonLabel size="small" class="font-semibold">{{ $t('History') }}</CommonLabel>
            <ul class="flex flex-col gap-2.5">
              <li v-for="round in status.history" :key="round.id" class="flex flex-col gap-0.5 text-sm">
                <span class="flex flex-wrap items-center gap-1.5">
                  <CommonBadge :variant="stateVariants[round.state]" size="xs">{{ $t(stateLabels[round.state]) }}</CommonBadge>
                  <span class="text-black dark:text-white">{{ round.approver?.name }}</span>
                </span>
                <span v-if="round.comment" class="whitespace-pre-wrap break-words text-gray-100 dark:text-neutral-400">{{
                  round.comment
                }}</span>
                <CommonDateTime
                  class="text-xs text-gray-100 dark:text-neutral-400"
                  :date-time="roundTime(round)"
                  type="relative"
                />
              </li>
            </ul>
          </section>
        </template>
      </div>
    </CommonLoader>
  </TicketSidebarContent>
</template>
