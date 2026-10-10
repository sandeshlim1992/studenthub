<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import CommonLabel from '#shared/components/CommonLabel/CommonLabel.vue'
import { useTicketView } from '#shared/entities/ticket/composables/useTicketView.ts'
import type { TicketById } from '#shared/entities/ticket/types'
import type { AppSpecificTicketArticleType } from '#shared/entities/ticket-article/action/plugins/types.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { useStudenthubQueueLayout } from '#desktop/pages/ticket/composables/useStudenthubQueueLayout.ts'

import ArticleReplyPanel from './ArticleReplyPanel.vue'
import StudenthubTicketReplyBar from './StudenthubTicketReplyBar.vue'
import { useArticleReply } from './useArticleReply.ts'

interface Props {
  ticket: TicketById
  parentReachedBottomScroll: boolean
  ticketArticleTypes: AppSpecificTicketArticleType[]
  createArticleType?: string | null
  newArticlePresent?: boolean
  hasInternalArticle?: boolean
}

const props = defineProps<Props>()

const currentTicket = toRef(props, 'ticket')
const { isTicketCustomer } = useTicketView(currentTicket)

// Student Hub: agents with the queue beside the ticket get the reply box (design option 1), docked
// at the bottom: at rest StudenthubTicketReplyBar, while writing Zammad's form in the same box.
// Students get the same box for their replies (no internal note, no Reply all).
const { isQueueLayout } = useStudenthubQueueLayout()

const { noteArticleType, phoneArticleType, customerReplyArticleType } = useArticleReply(
  currentTicket,
  toRef(props, 'ticketArticleTypes'),
)

const hasAgentReplyBox = computed(
  () => isQueueLayout.value && !isTicketCustomer.value && !!noteArticleType.value,
)
const hasStudentReplyBox = computed(
  () => isTicketCustomer.value && !!customerReplyArticleType.value,
)
const hasReplyBox = computed(() => hasAgentReplyBox.value || hasStudentReplyBox.value)

const emit = defineEmits<{
  'show-article-form': [
    articleType: string,
    performReply: AppSpecificTicketArticleType['performReply'],
  ]
  'discard-form': []
  submit: []
}>()

const pinned = defineModel<boolean>('pinned')

const showCustomerReplyForm = () => {
  if (!customerReplyArticleType.value) return

  emit(
    'show-article-form',
    customerReplyArticleType.value.articleType,
    customerReplyArticleType.value.performReply,
  )
}

const showNoteReplyForm = () => {
  if (!noteArticleType.value) return

  emit('show-article-form', noteArticleType.value.articleType, noteArticleType.value.performReply)
}
</script>

<template>
  <div
    v-if="newArticlePresent"
    role="complementary"
    aria-labelledby="article-reply-form-title"
    :aria-expanded="!pinned"
    v-bind="$attrs"
    :class="{
      'sticky bottom-0 z-20 self-end': pinned && !hasReplyBox,
      'sh-reply-dock': hasReplyBox,
    }"
  >
    <slot name="leading" />

    <ArticleReplyPanel
      :is-pinned="pinned && !hasReplyBox"
      :has-internal-article="hasInternalArticle"
      :is-ticket-customer="isTicketCustomer"
      :studenthub-box="hasReplyBox"
      :studenthub-student="hasStudentReplyBox"
      :studenthub-phone="!!phoneArticleType"
      @discard-form="$emit('discard-form')"
      @toggle-pin="pinned = !pinned"
      @submit="$emit('submit')"
    />
  </div>
  <div v-else-if="newArticlePresent !== undefined" :class="{ 'sh-reply-dock': hasReplyBox }">
    <StudenthubTicketReplyBar
      v-if="hasReplyBox"
      :student="hasStudentReplyBox"
      :phone="!!phoneArticleType"
    />
    <div v-else class="mx-auto flex w-full max-w-4xl flex-col items-center gap-3 px-12 pt-4 pb-6">
      <CommonButton
        v-if="isTicketCustomer && customerReplyArticleType"
        variant="primary"
        size="small"
        :prefix-icon="customerReplyArticleType.icon"
        @click="showCustomerReplyForm"
      >
        {{ $t(customerReplyArticleType.label) }}
      </CommonButton>

      <template v-else-if="!isTicketCustomer && noteArticleType">
        <div class="flex flex-row items-center gap-3">
          <CommonButton
            variant="tertiary"
            size="small"
            data-test-id="ticket-detail-show-article-form-button"
            :prefix-icon="noteArticleType.icon"
            @click="showNoteReplyForm"
          >
            {{ $t(noteArticleType.label) }}
          </CommonButton>

          <CommonLabel
            size="small"
            class="text-center text-sm text-stone-200 dark:text-neutral-500"
          >
            {{ $t('or use the reply actions on articles.') }}
          </CommonLabel>
        </div>
      </template>
    </div>
  </div>
</template>
