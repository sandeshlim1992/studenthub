<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useStudenthubNow } from '#desktop/components/Ticket/StudenthubTicketCells/useStudenthubNow.ts'
import {
  formatWait,
  isOverdue,
  type ManagerWaitingRequest,
} from '#desktop/pages/dashboard/utils/studenthubManagerDashboard.ts'
import { splitCampus, STUDENTHUB_INSTITUTION_COLORS } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub manager dashboard: the request that is open, with what the manager needs to
// decide (reason, the customer's latest message) and Approve / Deny. A comment is needed to deny.
interface Props {
  request: ManagerWaitingRequest
  position: number
  total: number
  next: ManagerWaitingRequest | null
  warningHours: number
  busy: boolean
  error: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  decide: [decision: 'approve' | 'deny', comment: string]
  previous: []
  next: []
}>()

const now = useStudenthubNow()

const comment = ref('')
const commentMissing = ref(false)

watch(
  () => props.request.ticket_id,
  () => {
    comment.value = ''
    commentMissing.value = false
  },
)

const overdue = computed(() => isOverdue(props.request.requested_at, now.value, props.warningHours))
const waited = computed(() =>
  formatWait((now.value.getTime() - new Date(props.request.requested_at).getTime()) / 1000),
)
const campus = computed(() => splitCampus(props.request.campus))
const askerFirstName = computed(() => props.request.requested_by?.split(' ')[0] ?? '')

const decide = (decision: 'approve' | 'deny') => {
  commentMissing.value = decision === 'deny' && !comment.value.trim()
  if (commentMissing.value) return

  emit('decide', decision, comment.value.trim())
}
</script>

<template>
  <article
    aria-labelledby="sh-manager-request-title"
    class="flex min-w-0 flex-col gap-[18px] rounded-xl border border-[var(--sh-line)] bg-white px-7 py-6 shadow-[0_1px_2px_rgb(14_15_17/0.06)]"
    data-test-id="manager-request"
  >
    <div class="flex flex-wrap items-center gap-2.5">
      <CommonLink
        :link="`/tickets/${request.ticket_id}`"
        internal
        class="sh-condensed text-[21px] font-bold tracking-wide text-[var(--sh-ink)]!"
      >
        #{{ request.number }}
      </CommonLink>
      <span
        v-if="campus.institution"
        class="rounded-sm border-[1.5px] border-current px-1 text-xs leading-[18px] font-bold tracking-wide"
        :style="{ color: STUDENTHUB_INSTITUTION_COLORS[campus.institution] }"
      >
        {{ campus.institution }}
      </span>
      <span
        class="rounded px-2 py-px text-sm font-bold"
        :class="overdue ? 'bg-[#fdeac4] text-[#7a4300]' : 'bg-[#eef0f3] text-[var(--sh-ink-2)]'"
      >
        {{
          overdue ? $t('Waiting %s · over %s h', waited, warningHours) : $t('Waiting %s', waited)
        }}
      </span>
      <span class="ms-auto inline-flex items-center gap-1.5 text-sm text-[var(--sh-ink-2)]">
        {{ $t('%s of %s', position, total) }}
        <button
          type="button"
          class="grid size-[34px] place-items-center rounded-md border border-[#c9cdd4] bg-white text-[var(--sh-ink)] disabled:cursor-default disabled:border-[#dcdfe4] disabled:text-[#a3a8b0]"
          :aria-label="$t('Previous request')"
          :disabled="position <= 1"
          @click="emit('previous')"
        >
          <CommonIcon name="chevron-left" size="tiny" decorative />
        </button>
        <button
          type="button"
          class="grid size-[34px] place-items-center rounded-md border border-[#c9cdd4] bg-white text-[var(--sh-ink)] disabled:cursor-default disabled:border-[#dcdfe4] disabled:text-[#a3a8b0]"
          :aria-label="$t('Next request')"
          :disabled="position >= total"
          @click="emit('next')"
        >
          <CommonIcon name="chevron-right" size="tiny" decorative />
        </button>
      </span>
    </div>

    <h2
      id="sh-manager-request-title"
      class="-mt-1.5 text-[27px] leading-tight font-bold tracking-tight text-[var(--sh-ink)]"
    >
      {{ request.title }}
    </h2>

    <dl class="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-3 text-sm">
      <div v-if="request.requested_by">
        <dt class="text-[var(--sh-muted)]">{{ $t('Asked by') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">
          {{
            request.team ? $t('%s, %s', request.requested_by, request.team) : request.requested_by
          }}
        </dd>
      </div>
      <div>
        <dt class="text-[var(--sh-muted)]">{{ $t('Sent') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">
          <CommonDateTime :date-time="request.requested_at" type="absolute" />
        </dd>
      </div>
      <div v-if="request.category">
        <dt class="text-[var(--sh-muted)]">{{ $t('Category') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">
          {{ request.category.replaceAll('::', ' › ') }}
        </dd>
      </div>
      <div v-if="request.customer">
        <dt class="text-[var(--sh-muted)]">{{ $t('Customer') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">{{ request.customer }}</dd>
      </div>
      <div v-if="request.campus">
        <dt class="text-[var(--sh-muted)]">{{ $t('Campus') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">
          {{ request.campus.replaceAll('::', ' › ') }}
        </dd>
      </div>
      <div>
        <dt class="text-[var(--sh-muted)]">{{ $t('SLA') }}</dt>
        <dd class="font-semibold text-[var(--sh-ink)]">
          {{ request.sla_paused ? $t('Paused while it waits') : $t('Not paused') }}
        </dd>
      </div>
    </dl>

    <section class="flex flex-col gap-1.5 border-t border-[#e8eaee] pt-4">
      <h3 class="text-[15px] font-bold text-[var(--sh-ink)]">
        {{ askerFirstName ? $t('%s’s reason', askerFirstName) : $t('Reason') }}
      </h3>
      <p
        class="max-w-[72ch] text-base leading-relaxed break-words whitespace-pre-line text-[var(--sh-ink)]"
      >
        {{ request.reason }}
      </p>
    </section>

    <section v-if="request.latest_message" class="flex flex-col gap-1.5">
      <h3 class="text-[15px] font-bold text-[var(--sh-ink)]">
        {{ $t('Latest message on the ticket') }}
      </h3>
      <blockquote class="flex flex-col gap-1 rounded-lg bg-[#f4f5f7] px-4 py-3">
        <span class="text-sm text-[var(--sh-ink-2)]">
          <template v-if="request.latest_message.from"
            >{{ request.latest_message.from }} ·
          </template>
          <CommonDateTime :date-time="request.latest_message.created_at" type="absolute" />
        </span>
        <span class="max-w-[72ch] leading-relaxed break-words text-[var(--sh-ink)]">{{
          request.latest_message.body
        }}</span>
      </blockquote>
    </section>

    <div class="flex flex-col gap-2.5 border-t border-[#e8eaee] pt-4">
      <label
        for="sh-manager-comment"
        class="flex flex-col gap-2.5 text-sm font-bold text-[var(--sh-ink)]"
      >
        <span>
          {{ $t('Comment') }}
          <span class="font-normal text-[var(--sh-ink-2)]">
            ·
            {{
              askerFirstName
                ? $t('needed to deny, optional to approve. %s sees it.', askerFirstName)
                : $t('needed to deny, optional to approve.')
            }}
          </span>
        </span>
        <textarea
          id="sh-manager-comment"
          v-model="comment"
          rows="2"
          class="w-full resize-y rounded-md border bg-white px-2.5 py-2 text-sm leading-normal font-normal text-[var(--sh-ink)] focus:outline-2 focus:outline-[var(--sh-app)]"
          :class="commentMissing ? 'border-[#b42318]' : 'border-[#8f949d]'"
          :aria-invalid="commentMissing ? 'true' : undefined"
          :aria-describedby="commentMissing ? 'sh-manager-comment-error' : undefined"
        ></textarea>
      </label>
      <p
        v-if="commentMissing"
        id="sh-manager-comment-error"
        class="text-sm font-semibold text-[#b42318]"
      >
        {{ $t('Add a comment to deny the request.') }}
      </p>
      <CommonAlert v-if="error" variant="danger">{{ $t(error) }}</CommonAlert>

      <div class="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          class="inline-flex h-11 items-center gap-1.5 rounded-md border border-[var(--sh-app)] bg-[var(--sh-app)] px-5 font-semibold text-white hover:bg-[var(--sh-app-hover)] disabled:opacity-60"
          :disabled="busy"
          @click="decide('approve')"
        >
          <CommonIcon name="check2" size="tiny" decorative />
          {{ $t('Approve') }}
        </button>
        <button
          type="button"
          class="inline-flex h-11 items-center gap-1.5 rounded-md border border-[#8f949d] bg-white px-5 font-semibold text-[var(--sh-ink)] hover:bg-[#f4f5f7] disabled:opacity-60"
          :disabled="busy"
          @click="decide('deny')"
        >
          <CommonIcon name="x-lg" size="tiny" decorative />
          {{ $t('Deny') }}
        </button>
        <CommonLink
          :link="`/tickets/${request.ticket_id}`"
          internal
          class="font-semibold text-[var(--sh-ink)]! underline underline-offset-3"
        >
          {{ $t('Open ticket') }}
        </CommonLink>
        <span v-if="next" class="ms-auto truncate text-sm text-[var(--sh-ink-2)]">
          {{ $t('Next: #%s %s', next.number, next.title) }}
        </span>
      </div>
    </div>
  </article>
</template>
