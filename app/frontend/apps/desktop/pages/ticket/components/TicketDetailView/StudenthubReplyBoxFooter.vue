<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { StudenthubReplyMode } from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'

// Student Hub: the foot of the agents' reply box (design option A), the same at rest and while
// writing: Reply / Internal note as a switch under the text, then attach and Send. While writing
// it also says how many ticket fields are saved with the message (Send is Update) and offers the
// bin, which discards the text.
interface Props {
  mode: StudenthubReplyMode
  writing?: boolean
  ticketChanges?: number
  disabled?: boolean
  // undefined: not offered (no other recipients, or a note)
  replyAll?: boolean
  // Students only reply: no Reply / Internal note switch
  student?: boolean
}

const props = defineProps<Props>()

defineEmits<{
  mode: [StudenthubReplyMode]
  'reply-all': [boolean]
  attach: []
  send: []
  discard: []
}>()

const sendLabel = computed(() => (props.mode === 'note' ? __('Add note') : __('Send')))
</script>

<template>
  <div class="sh-reply-box__foot">
    <div
      v-if="!student"
      class="sh-reply-mode"
      role="radiogroup"
      :aria-label="$t('Reply or internal note')"
    >
      <button
        type="button"
        role="radio"
        class="sh-reply-mode__option"
        :aria-checked="mode === 'reply'"
        :disabled="disabled"
        @click="$emit('mode', 'reply')"
      >
        <CommonIcon name="reply" size="xs" decorative />
        {{ $t('Reply') }}
      </button>
      <button
        type="button"
        role="radio"
        class="sh-reply-mode__option sh-reply-mode__option--note"
        :aria-checked="mode === 'note'"
        :disabled="disabled"
        @click="$emit('mode', 'note')"
      >
        <CommonIcon name="pencil-square" size="xs" decorative />
        {{ $t('Internal note') }}
      </button>
    </div>

    <button
      v-if="writing && replyAll !== undefined"
      type="button"
      class="sh-reply-box__toggle"
      :aria-pressed="replyAll"
      :disabled="disabled"
      @click="$emit('reply-all', !replyAll)"
    >
      <CommonIcon name="reply-all" size="xs" decorative />
      {{ $t('Reply all') }}
    </button>

    <span class="grow" />

    <span v-if="writing && ticketChanges" class="sh-reply-box__changes">
      {{ ticketChanges === 1 ? $t('+ 1 ticket change') : $t('+ %s ticket changes', ticketChanges) }}
    </span>

    <button
      v-if="writing"
      v-tooltip="$t('Discard unsaved reply')"
      type="button"
      class="sh-reply-box__icon sh-reply-box__icon--danger"
      :aria-label="$t('Discard unsaved reply')"
      :disabled="disabled"
      @click="$emit('discard')"
    >
      <CommonIcon name="trash" size="xs" decorative />
    </button>
    <button
      v-tooltip="$t('Attach files')"
      type="button"
      class="sh-reply-box__icon"
      :aria-label="$t('Attach files')"
      :disabled="disabled"
      @click="$emit('attach')"
    >
      <CommonIcon name="paperclip" size="xs" decorative />
    </button>
    <button
      type="button"
      class="sh-reply-box__send"
      :class="{ 'sh-reply-box__send--note': mode === 'note' }"
      :disabled="!writing || disabled"
      @click="$emit('send')"
    >
      {{ $t(sendLabel) }}
      <kbd v-if="writing" aria-hidden="true">Ctrl ↵</kbd>
    </button>
  </div>
</template>
