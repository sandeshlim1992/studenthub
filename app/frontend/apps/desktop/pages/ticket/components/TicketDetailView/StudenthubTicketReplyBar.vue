<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubTicketReply } from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

// Student Hub: the agents' reply bar under the messages (design option B), in place of Zammad's
// "Add note, or use the reply actions on articles". Reply (and the bar itself) answers the
// student's latest message; Internal note opens Zammad's note form (emitted, so ArticleReply
// opens it as before). The bar makes way for the reply form once that is open.
defineEmits<{
  note: []
}>()

const { ticket } = useTicketInformation()
const { reply } = useStudenthubTicketReply()

const name = computed(
  () => ticket.value?.customer.firstname?.trim() || ticket.value?.customer.fullname || '',
)
</script>

<template>
  <div class="sh-reply-bar" role="group" :aria-label="$t('Reply')">
    <button type="button" class="sh-reply-bar__write" @click="reply">
      <CommonIcon name="reply" size="tiny" decorative />
      <span class="truncate">
        {{ name ? $t('Write a reply to %s…', name) : $t('Write a reply…') }}
      </span>
    </button>
    <button
      type="button"
      class="sh-header-action"
      data-test-id="ticket-detail-show-article-form-button"
      @click="$emit('note')"
    >
      <CommonIcon name="pencil-square" size="xs" decorative />
      {{ $t('Internal note') }}
    </button>
    <button type="button" class="sh-header-action sh-header-action--primary" @click="reply">
      <CommonIcon name="reply" size="xs" decorative />
      {{ $t('Reply') }}
    </button>
  </div>
</template>
