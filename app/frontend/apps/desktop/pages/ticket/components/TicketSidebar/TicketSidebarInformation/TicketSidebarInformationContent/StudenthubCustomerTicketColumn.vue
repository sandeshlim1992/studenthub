<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { useCopyToClipboard } from '#shared/composables/useCopyToClipboard.ts'
import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import type { TicketById } from '#shared/entities/ticket/types.ts'
import { i18n } from '#shared/i18n.ts'
import type { ObjectLike } from '#shared/types/utils.ts'
import { humanizeFileSize } from '#shared/utils/files.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonSectionCollapse from '#desktop/components/CommonSectionCollapse/CommonSectionCollapse.vue'
import { useStudenthubNow } from '#desktop/components/Ticket/StudenthubTicketCells/useStudenthubNow.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import { StudenthubApiError, studenthubApi } from '#desktop/utils/studenthubApi.ts'
import {
  STUDENTHUB_CUSTOMER_TICKET_STATUS,
  STUDENTHUB_CUSTOMER_TICKET_STEPS,
  studenthubCustomerTicketPath,
  type StudenthubCustomerTicketOverview,
} from '#desktop/utils/studenthubCustomerTicket.ts'
import { formatDayTime } from '#desktop/utils/studenthubTicketDetails.ts'
import { STUDENTHUB_STATE_TONES } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: the student's column on the ticket screen, in place of the staff Details.
// Your request (summary), Progress (four steps), Files (shared in the conversation) and
// Need anything else? (close, reopen, rate). Reloads whenever the ticket changes.
interface Props {
  ticket: Pick<TicketById, 'internalId' | 'updatedAt'>
}

const props = defineProps<Props>()

const persistentStates = defineModel<ObjectLike>({ required: true })

const router = useRouter()
const now = useStudenthubNow()
const { notify } = useNotifications()
const { waitForConfirmation } = useConfirmation()
const { copyToClipboard } = useCopyToClipboard()

const { form, showTicketArticleReplyForm } = useTicketInformation()
const { openReplyForm } = useTicketArticleReplyAction(form, showTicketArticleReplyForm)

const overview = ref<StudenthubCustomerTicketOverview | null>(null)
const loadFailed = ref(false)
let loadRequest = 0

const load = async (ticketId: number) => {
  const request = ++loadRequest
  try {
    const data = await studenthubApi<StudenthubCustomerTicketOverview>(
      studenthubCustomerTicketPath(ticketId),
    )
    if (request !== loadRequest) return
    overview.value = data
    loadFailed.value = false
  } catch {
    if (request === loadRequest) loadFailed.value = true
  }
}

watch(
  () => [props.ticket.internalId, props.ticket.updatedAt] as const,
  ([ticketId]) => load(ticketId),
  { immediate: true },
)

const stage = computed(() => overview.value?.progress.stage ?? 'received')
const status = computed(() => STUDENTHUB_CUSTOMER_TICKET_STATUS[stage.value])
const statusTone = computed(() => STUDENTHUB_STATE_TONES[status.value.tone])

const stepState = (index: number) => {
  const step = overview.value?.progress.step ?? 0
  if (index < step) return 'done'
  return index === step ? 'current' : 'next'
}

const busy = ref(false)

const run = async (action: string, body: unknown, success: string) => {
  busy.value = true
  try {
    overview.value = await studenthubApi<StudenthubCustomerTicketOverview>(
      studenthubCustomerTicketPath(props.ticket.internalId, action),
      { method: 'POST', body },
    )
    notify({ id: `studenthub-customer-${action}`, type: NotificationTypes.Success, message: success })
    return true
  } catch (error) {
    notify({
      id: `studenthub-customer-${action}-error`,
      type: NotificationTypes.Error,
      message:
        error instanceof StudenthubApiError
          ? error.message
          : __('Something went wrong. Please try again.'),
    })
    return false
  } finally {
    busy.value = false
  }
}

const reply = () => openReplyForm({ articleType: 'web', internal: false })

const closeRequest = async () => {
  const confirmed = await waitForConfirmation(
    __('You can still reopen it if the problem comes back.'),
    { headerTitle: __('Close this request?'), buttonLabel: __('Close request') },
  )
  if (!confirmed) return

  await run('close', {}, __('Your request is closed.'))
}

const isReopening = ref(false)
const reopenMessage = ref('')

const reopen = async () => {
  if (!reopenMessage.value.trim()) return
  if (!(await run('reopen', { message: reopenMessage.value }, __('Your request is open again.')))) return

  isReopening.value = false
  reopenMessage.value = ''
}

const rating = ref(0)
const ratingComments = ref('')

const rate = async () => {
  if (!rating.value) return

  await run(
    'rating',
    { rating: rating.value, comments: ratingComments.value },
    __('Thank you for your feedback.'),
  )
}

const stars = (value: number) => '★'.repeat(value) + '☆'.repeat(5 - value)

const newTicket = () => router.push({ name: 'TicketCreate', query: { mode: 'wizard' } })

const hasActions = computed(() => {
  const { value } = overview
  if (!value) return false

  return (
    value.actions.can_close ||
    value.actions.can_reopen ||
    value.actions.new_ticket ||
    Boolean(value.feedback)
  )
})
</script>

<template>
  <p v-if="!overview && loadFailed" class="text-sm text-gray-100 dark:text-neutral-400">
    {{ $t('Your request could not be loaded. Please reload the page.') }}
  </p>

  <template v-if="overview">
    <CommonSectionCollapse
      id="ticket-customer-summary"
      v-model="persistentStates.collapseCustomerSummary"
      :title="__('Your request')"
    >
      <dl class="sh-details-list" data-test-id="studenthub-customer-summary">
        <dt>{{ $t('Reference') }}</dt>
        <dd class="sh-customer-ticket__reference">
          #{{ overview.number }}
          <button
            v-tooltip="$t('Copy reference number')"
            type="button"
            class="sh-customer-ticket__copy"
            :aria-label="$t('Copy reference number')"
            @click="copyToClipboard(overview.number)"
          >
            <CommonIcon name="files" size="xs" decorative />
          </button>
        </dd>

        <dt>{{ $t('Status') }}</dt>
        <dd>
          <span
            class="sh-customer-ticket__status"
            :style="{ backgroundColor: statusTone.background, color: statusTone.text }"
          >
            {{ $t(status.label) }}
          </span>
        </dd>

        <template v-for="field in overview.fields" :key="field.name">
          <dt>{{ $t(field.label) }}</dt>
          <dd>{{ field.value }}</dd>
        </template>

        <template v-if="overview.team">
          <dt>{{ $t('Team') }}</dt>
          <dd>{{ overview.team }}</dd>
        </template>

        <dt>{{ $t('Opened') }}</dt>
        <dd :title="i18n.dateTime(overview.created_at)">
          {{ formatDayTime(overview.created_at, now) }}
        </dd>

        <dt>{{ $t('Last reply from us') }}</dt>
        <dd v-if="overview.last_team_reply_at" :title="i18n.dateTime(overview.last_team_reply_at)">
          {{ formatDayTime(overview.last_team_reply_at, now) }}
        </dd>
        <dd v-else class="sh-details-list__empty">{{ $t('No reply yet') }}</dd>
      </dl>
    </CommonSectionCollapse>

    <CommonSectionCollapse
      id="ticket-customer-progress"
      v-model="persistentStates.collapseCustomerProgress"
      :title="__('Progress')"
    >
      <div class="sh-customer-progress" data-test-id="studenthub-customer-progress">
        <ol class="sh-customer-progress__steps">
          <li
            v-for="(label, index) in STUDENTHUB_CUSTOMER_TICKET_STEPS"
            :key="label"
            :data-state="stepState(index)"
            :aria-current="stepState(index) === 'current' ? 'step' : undefined"
          >
            <span class="sh-customer-progress__marker" aria-hidden="true">
              <CommonIcon v-if="stepState(index) === 'done'" name="check2" size="xs" decorative />
            </span>
            <span>{{ $t(label) }}</span>
          </li>
        </ol>

        <div
          class="sh-customer-progress__note"
          :style="{ backgroundColor: statusTone.background, color: statusTone.text }"
          role="status"
        >
          <strong>{{ $t(status.label) }}</strong>
          <span>{{ $t(status.note) }}</span>
        </div>

        <CommonButton
          v-if="stage === 'waiting_for_you'"
          variant="primary"
          prefix-icon="reply"
          block
          @click="reply"
        >
          {{ $t('Reply') }}
        </CommonButton>
      </div>
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="overview.files.length"
      id="ticket-customer-files"
      v-model="persistentStates.collapseCustomerFiles"
      :title="__('Files')"
    >
      <ul class="sh-customer-files" data-test-id="studenthub-customer-files">
        <li v-for="file in overview.files" :key="file.id">
          <CommonIcon name="paperclip" size="xs" class="shrink-0" decorative />
          <div class="min-w-0">
            <a :href="file.url" class="sh-customer-files__name" download>{{ file.filename }}</a>
            <span class="sh-customer-files__meta">
              {{ humanizeFileSize(file.size) }} ·
              {{ file.from_team ? $t('From the team') : $t('From you') }} ·
              {{ formatDayTime(file.created_at, now) }}
            </span>
          </div>
        </li>
      </ul>
    </CommonSectionCollapse>

    <CommonSectionCollapse
      v-if="hasActions"
      id="ticket-customer-actions"
      v-model="persistentStates.collapseCustomerActions"
      :title="__('Need anything else?')"
    >
      <div class="sh-customer-actions" data-test-id="studenthub-customer-actions">
        <div v-if="overview.feedback?.state === 'submitted'" class="sh-customer-actions__rated">
          <span>{{ $t('You rated our support') }}</span>
          <span
            class="sh-customer-actions__stars"
            :aria-label="$t('%s of 5 stars', overview.feedback.rating)"
            role="img"
          >
            {{ stars(overview.feedback.rating) }}
          </span>
          <q v-if="overview.feedback.comments">{{ overview.feedback.comments }}</q>
        </div>

        <form
          v-else-if="overview.feedback?.state === 'awaiting'"
          class="sh-customer-actions__form"
          :aria-label="$t('Rate our support')"
          @submit.prevent="rate"
        >
          <fieldset>
            <legend>{{ $t('How did we do?') }}</legend>
            <div class="sh-customer-actions__star-input">
              <label
                v-for="value in 5"
                :key="value"
                :for="`studenthub-customer-rating-${value}`"
                :data-active="value <= rating || undefined"
              >
                <input
                  :id="`studenthub-customer-rating-${value}`"
                  v-model="rating"
                  class="sr-only"
                  type="radio"
                  name="studenthub-customer-rating"
                  :value="value"
                  :aria-label="$t('%s of 5 stars', value)"
                />
                <span aria-hidden="true">★</span>
              </label>
            </div>
          </fieldset>
          <label for="studenthub-customer-rating-comments">
            <span>{{ $t('Anything to add? (optional)') }}</span>
            <textarea id="studenthub-customer-rating-comments" v-model="ratingComments" rows="2" />
          </label>
          <CommonButton type="submit" variant="primary" block :disabled="!rating || busy">
            {{ $t('Send rating') }}
          </CommonButton>
        </form>

        <form
          v-if="isReopening"
          class="sh-customer-actions__form"
          :aria-label="$t('Reopen request')"
          @submit.prevent="reopen"
        >
          <label for="studenthub-customer-reopen">
            <span>{{ $t('What is still not working?') }}</span>
            <textarea id="studenthub-customer-reopen" v-model="reopenMessage" rows="3" required />
          </label>
          <div class="flex gap-2">
            <CommonButton
              type="submit"
              variant="primary"
              :disabled="!reopenMessage.trim() || busy"
            >
              {{ $t('Reopen request') }}
            </CommonButton>
            <CommonButton variant="secondary" @click="isReopening = false">
              {{ $t('Cancel') }}
            </CommonButton>
          </div>
        </form>

        <template v-else>
          <CommonButton
            v-if="overview.actions.can_close && stage === 'resolved'"
            variant="primary"
            prefix-icon="check2"
            block
            :disabled="busy"
            @click="closeRequest"
          >
            {{ $t('Yes, it is fixed: close it') }}
          </CommonButton>
          <CommonButton
            v-if="overview.actions.can_reopen"
            variant="secondary"
            prefix-icon="arrow-repeat"
            block
            :disabled="busy"
            @click="isReopening = true"
          >
            {{ $t('Still not fixed? Reopen') }}
          </CommonButton>
          <CommonButton
            v-if="overview.actions.can_close && stage !== 'resolved'"
            variant="secondary"
            prefix-icon="x-lg"
            block
            :disabled="busy"
            @click="closeRequest"
          >
            {{ $t('I no longer need help') }}
          </CommonButton>

          <template v-if="overview.actions.new_ticket">
            <p class="text-sm text-gray-100 dark:text-neutral-400">
              {{ $t('This request is closed and cannot be reopened. Raise a new ticket if you still need help.') }}
            </p>
            <CommonButton variant="primary" prefix-icon="plus" block @click="newTicket">
              {{ $t('Raise a New Ticket') }}
            </CommonButton>
          </template>
        </template>
      </div>
    </CommonSectionCollapse>

    <!-- The ticket's Update bar covers the bottom of this column: room to scroll past it. -->
    <div class="sh-customer-ticket__end" aria-hidden="true" />
  </template>
</template>
