<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useNow } from '@vueuse/core'
import { computed, ref, type UnwrapNestedRefs } from 'vue'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaNode, FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { i18n } from '#shared/i18n.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import type { ObjectLike } from '#shared/types/utils.ts'

import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import type { TicketSidebarContentProps } from '#desktop/pages/ticket/types/sidebar.ts'

import TicketSidebarContent from '../TicketSidebarContent.vue'

import type { ApprovalRound, ApprovalUser, TicketApproval } from './useTicketApproval.ts'

// Student Hub Ticket Approvals: the Approval tab (design B of the approval panel redesign). A chip
// says where the ticket stands, the form sends it to a manager (open while nothing was sent yet,
// later behind "Send for approval again"), and a timeline lists every request and decision,
// newest first. While the ticket waits, the newest step carries the action: Withdraw for the
// agent who asked, Comment and Approve / Deny for the manager.

interface Props extends TicketSidebarContentProps {
  approval: UnwrapNestedRefs<TicketApproval>
}

const props = defineProps<Props>()

const persistentStates = defineModel<ObjectLike>({ required: true })

type Tone = 'approved' | 'denied' | 'plain'

interface TimelineEvent {
  key: string
  tone: Tone
  title: string
  at: string
  team: string | null
  text: string | null
  // The newest request's texts stand out in a box; older ones are plain.
  quoted: boolean
}

const DOT_CLASSES: Record<Tone, string> = {
  approved: 'bg-[#16794a] shadow-[0_0_0_3px_#dff3e7]',
  denied: 'bg-[#b4232f] shadow-[0_0_0_3px_#fde7e9]',
  plain: 'border-2 border-[#9aa1ad] bg-white dark:bg-gray-500',
}

type ChipTone = 'waiting' | 'approved' | 'denied' | 'neutral'

// The colours of the dashboards' chips (each pair at 4.5:1 or more).
const CHIP_CLASSES: Record<ChipTone, string> = {
  waiting: 'bg-[#fff1cc] text-[#8f5b00] dark:bg-[rgba(146,64,14,0.35)] dark:text-[#fcd34d]',
  approved: 'bg-[#dff3e7] text-[#16794a] dark:bg-[rgba(22,101,52,0.35)] dark:text-[#86efac]',
  denied: 'bg-[#fde7e9] text-[#b4232f] dark:bg-[rgba(153,27,27,0.35)] dark:text-[#fca5a5]',
  neutral: 'bg-[#eceef1] text-[#4a5262] dark:bg-[rgb(51,65,85)] dark:text-[#cbd5e1]',
}

const BUTTON =
  'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60'
const primaryButton = `${BUTTON} bg-app text-on-app hover:bg-app-hover`
const outlineButton = `${BUTTON} border border-[#c9cdd4] bg-white text-[var(--sh-ink)] hover:bg-[var(--sh-row-hover)] dark:border-gray-900 dark:bg-gray-500 dark:text-white`
const dangerButton = `${BUTTON} border border-[#e3a7ad] bg-white text-[#b4232f] hover:bg-[#fdf2f3] dark:border-red-900 dark:bg-gray-500 dark:text-red-300`

const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()
const session = useSessionStore()
const now = useNow({ interval: 60000 })

const { form: requestForm, formNodeId: requestFormNodeId, formReset: resetRequestForm } = useForm()
const { form: decisionForm, values: decisionValues, formReset: resetDecisionForm } = useForm()

const status = computed(() => props.approval.status)

const myId = computed(() => (session.userId ? Number(getIdFromGraphQLId(session.userId)) : null))
const isMe = (user: ApprovalUser | null) => !!user && user.id === myId.value
const nameOf = (user: ApprovalUser | null) => user?.name ?? '-'

// Every request, newest first. The server lists the waiting one in the history too.
const rounds = computed<ApprovalRound[]>(() => {
  const history = status.value?.history ?? []
  const current = status.value?.current
  if (!current || history.some((round) => round.id === current.id)) return history

  return [current, ...history]
})

const waitingRound = computed(() =>
  status.value?.state === 'pending'
    ? (status.value.current ?? rounds.value.find((round) => round.state === 'pending') ?? null)
    : null,
)

const waitedFor = (since: string) => {
  const minutes = Math.max(0, Math.floor((now.value.getTime() - new Date(since).getTime()) / 60000))
  if (minutes < 60) return i18n.t('%s min', minutes)

  const hours = Math.floor(minutes / 60)
  if (hours < 48) return i18n.t('%s h', hours)

  return i18n.t('%s d', Math.floor(hours / 24))
}

const chip = computed<{ label: string; tone: ChipTone }>(() => {
  switch (status.value?.state) {
    case 'pending':
      if (status.value.can_decide) return { label: i18n.t('Your decision'), tone: 'waiting' }
      return {
        label: waitingRound.value
          ? i18n.t('Waiting · %s', waitedFor(waitingRound.value.requested_at))
          : i18n.t('Waiting for approval'),
        tone: 'waiting',
      }
    case 'approved':
      return { label: i18n.t('Approved'), tone: 'approved' }
    case 'denied':
      return { label: i18n.t('Denied'), tone: 'denied' }
    default:
      if (rounds.value[0]?.state === 'cancelled') {
        return { label: i18n.t('Withdrawn'), tone: 'neutral' }
      }
      return { label: i18n.t('Not sent'), tone: 'neutral' }
  }
})

// Who may open the ticket while it waits, for everyone but the manager deciding.
const waitingNote = computed(() => {
  const round = waitingRound.value
  if (!round) return ''

  const access = isMe(round.requested_by)
    ? i18n.t('Only %s and you can open the ticket.', nameOf(round.approver))
    : i18n.t(
        'Only %s and %s can open the ticket.',
        nameOf(round.approver),
        nameOf(round.requested_by),
      )

  return round.sla_paused ? `${access} ${i18n.t('Its SLA is paused.')}` : access
})

const sentTitle = (round: ApprovalRound) => {
  if (isMe(round.requested_by)) return i18n.t('You sent it to %s', nameOf(round.approver))
  if (isMe(round.approver)) return i18n.t('%s sent it to you', nameOf(round.requested_by))

  return i18n.t('%s sent it to %s', nameOf(round.requested_by), nameOf(round.approver))
}

const decidedTitle = (round: ApprovalRound) => {
  switch (round.state) {
    case 'approved':
      return i18n.t('Approved by %s', nameOf(round.decided_by))
    case 'denied':
      return i18n.t('Denied by %s', nameOf(round.decided_by))
    default:
      return round.decided_by
        ? i18n.t('Withdrawn by %s', nameOf(round.decided_by))
        : i18n.t('Withdrawn')
  }
}

const decidedTone = (round: ApprovalRound): Tone => {
  if (round.state === 'approved') return 'approved'
  if (round.state === 'denied') return 'denied'

  return 'plain'
}

// Each request gives "… sent it to …" and, once decided or withdrawn, its outcome above it.
const events = computed(() =>
  rounds.value.flatMap((round, index) => {
    const sent: TimelineEvent = {
      key: `${round.id}-sent`,
      tone: 'plain',
      title: sentTitle(round),
      at: round.requested_at,
      team: round.team,
      text: round.reason,
      quoted: index === 0,
    }
    if (round.state === 'pending' || !round.decided_at) return [sent]

    const decided: TimelineEvent = {
      key: `${round.id}-decided`,
      tone: decidedTone(round),
      title: decidedTitle(round),
      at: round.decided_at,
      team: null,
      text: round.comment,
      quoted: index === 0,
    }

    return [decided, sent]
  }),
)

const isComposing = ref(false)

const showForm = computed(
  () => !!status.value?.can_request && (!rounds.value.length || isComposing.value),
)
const canSendAgain = computed(
  () => !!status.value?.can_request && rounds.value.length > 0 && !isComposing.value,
)

// Every manager, whatever the team: the ticket waits in the Managers group, where the chosen
// manager can open it.
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
          options: (status.value?.managers ?? []).map((manager) => ({
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
        props: {
          rows: 4,
          maxlength: 5000,
          placeholder: __('What does the manager need to know to decide?'),
        },
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

const sendForApproval = async (
  data: FormSubmitData<{ approver_id: number | string; reason: string }>,
) => {
  const ok = await props.approval.sendForApproval(Number(data.approver_id), data.reason)
  if (!ok) return

  resetRequestForm()
  isComposing.value = false
  done(__('Sent for approval.'))
}

const decide = async (decision: 'approve' | 'deny') => {
  const comment = String((decisionValues.value as { comment?: string }).comment ?? '')
  const ok =
    decision === 'approve'
      ? await props.approval.approve(comment)
      : await props.approval.deny(comment)
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
</script>

<template>
  <TicketSidebarContent
    v-model="persistentStates.scrollPosition"
    :title="sidebarPlugin.title"
    :icon="sidebarPlugin.icon"
  >
    <CommonLoader :loading="approval.isLoading && !status">
      <div class="flex flex-col gap-4 text-sm text-[var(--sh-ink)] dark:text-white">
        <CommonAlert v-if="approval.errorMessage" variant="danger">
          {{ approval.errorMessage }}
        </CommonAlert>

        <template v-if="status">
          <div>
            <span
              class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold"
              :class="CHIP_CLASSES[chip.tone]"
              >{{ chip.label }}</span
            >
          </div>

          <section
            v-if="showForm"
            class="sh-approval-form flex flex-col gap-3"
            :aria-label="$t('Send for approval')"
          >
            <p
              v-if="!status.managers.length"
              class="m-0 text-[var(--sh-muted)] dark:text-neutral-400"
            >
              {{ $t('There are no managers yet. Give someone the Managers role first.') }}
            </p>
            <template v-else>
              <Form
                ref="requestForm"
                :schema="requestSchema"
                @submit="
                  sendForApproval(
                    $event as FormSubmitData<{ approver_id: number | string; reason: string }>,
                  )
                "
              />
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="grow"
                  :class="primaryButton"
                  :form="requestFormNodeId"
                  :disabled="approval.isBusy"
                >
                  {{ $t('Send for approval') }}
                </button>
                <button
                  v-if="rounds.length"
                  type="button"
                  :class="outlineButton"
                  @click="isComposing = false"
                >
                  {{ $t('Cancel') }}
                </button>
              </div>
            </template>
          </section>

          <button
            v-else-if="canSendAgain"
            type="button"
            :class="outlineButton"
            @click="isComposing = true"
          >
            <CommonIcon name="plus" size="tiny" decorative />
            {{ $t('Send for approval again') }}
          </button>

          <p
            v-if="!rounds.length && status.can_request"
            class="m-0 flex gap-2.5 rounded-[10px] border border-dashed border-[#c9cdd4] p-3.5 text-xs leading-normal text-[var(--sh-muted)] dark:border-gray-900 dark:text-neutral-400"
          >
            <CommonIcon name="clock-history" size="xs" class="mt-0.5 shrink-0" decorative />
            <span>{{
              $t(
                'No requests yet. Each request and decision shows here, newest first. While a request waits, only the manager and you can open the ticket.',
              )
            }}</span>
          </p>

          <ol
            v-if="rounds.length"
            class="m-0 flex list-none flex-col p-0"
            :aria-label="$t('Requests and decisions')"
          >
            <!-- The step in progress, with its action -->
            <li v-if="waitingRound" class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
              <span aria-hidden="true" class="flex flex-col items-center">
                <span
                  class="mt-1 size-3 rounded-full bg-[#d18a00] shadow-[0_0_0_4px_#fff1cc]"
                ></span>
                <span class="mt-2 w-0.5 grow bg-[var(--sh-line)] dark:bg-gray-900"></span>
              </span>
              <div class="flex min-w-0 flex-col gap-2 pb-4">
                <p class="m-0 font-bold">
                  {{
                    status.can_decide
                      ? $t('Your decision')
                      : $t('Waiting for %s', nameOf(waitingRound.approver))
                  }}
                </p>

                <section
                  v-if="status.can_decide"
                  class="sh-approval-form flex flex-col gap-3"
                  :aria-label="$t('Your decision')"
                >
                  <Form ref="decisionForm" :schema="decisionSchema" />
                  <div class="flex gap-2">
                    <button
                      type="button"
                      class="grow"
                      :class="primaryButton"
                      :disabled="approval.isBusy"
                      @click="decide('approve')"
                    >
                      <CommonIcon name="check2" size="tiny" decorative />
                      {{ $t('Approve') }}
                    </button>
                    <button
                      type="button"
                      class="grow"
                      :class="dangerButton"
                      :disabled="approval.isBusy"
                      @click="decide('deny')"
                    >
                      <CommonIcon name="x-lg" size="tiny" decorative />
                      {{ $t('Deny') }}
                    </button>
                  </div>
                </section>

                <template v-else>
                  <p
                    class="m-0 text-xs leading-normal text-[var(--sh-muted)] dark:text-neutral-400"
                  >
                    {{ waitingNote }}
                  </p>
                  <div v-if="status.can_cancel">
                    <button
                      type="button"
                      :class="outlineButton"
                      :disabled="approval.isBusy"
                      @click="withdraw"
                    >
                      <CommonIcon name="x-circle" size="tiny" decorative />
                      {{ $t('Withdraw request') }}
                    </button>
                  </div>
                </template>
              </div>
            </li>

            <li
              v-for="(event, index) in events"
              :key="event.key"
              class="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5"
            >
              <span aria-hidden="true" class="flex flex-col items-center">
                <span
                  class="mt-1 box-border size-3 rounded-full"
                  :class="DOT_CLASSES[event.tone]"
                ></span>
                <span
                  v-if="index < events.length - 1"
                  class="mt-2 w-0.5 grow bg-[var(--sh-line)] dark:bg-gray-900"
                ></span>
              </span>
              <div
                class="flex min-w-0 flex-col gap-1"
                :class="{ 'pb-4': index < events.length - 1 }"
              >
                <p class="m-0 font-semibold">{{ event.title }}</p>
                <p class="m-0 text-xs text-[var(--sh-muted)] dark:text-neutral-400">
                  <CommonDateTime :date-time="event.at" type="relative" />
                  <template v-if="event.team"> · {{ event.team }}</template>
                </p>
                <blockquote
                  v-if="event.text && event.quoted"
                  class="m-0 mt-1 rounded-lg border border-[#e8eaee] bg-white px-3 py-2.5 leading-normal break-words whitespace-pre-wrap dark:border-gray-900 dark:bg-gray-500"
                >
                  {{ event.text }}
                </blockquote>
                <p
                  v-else-if="event.text"
                  class="m-0 leading-normal break-words whitespace-pre-wrap text-[var(--sh-ink-2)] dark:text-neutral-400"
                >
                  {{ event.text }}
                </p>
              </div>
            </li>
          </ol>
        </template>
      </div>
    </CommonLoader>
  </TicketSidebarContent>
</template>
