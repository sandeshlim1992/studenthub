<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import {
  type StudenthubReplyMode,
  useStudenthubTicketReply,
} from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import StudenthubReplyBoxFooter from './StudenthubReplyBoxFooter.vue'

// Student Hub: the agents' reply box at rest, docked under the messages (design option A). It is a
// real text box with Reply / Internal note under it, so the mode shows before anyone writes. The
// first click or keystroke opens Zammad's reply form in its place (ArticleReplyPanel, styled as
// the same box) in that mode, keeping what was typed. Reply answers the student's latest message.
// Students get the box too, for their replies only (no Reply / Internal note switch).
const props = defineProps<{
  student?: boolean
}>()

const { ticket } = useTicketInformation()
const { open } = useStudenthubTicketReply()

const mode = ref<StudenthubReplyMode>('reply')

const name = computed(
  () => ticket.value?.customer.firstname?.trim() || ticket.value?.customer.fullname || '',
)

const placeholder = computed(() => {
  if (props.student) return __('Write your reply…')
  if (mode.value === 'note') return __('Write an internal note…')
  return name.value ? __('Write a reply to %s…') : __('Write a reply…')
})

let opening = false

const start = (typed = '') => {
  if (opening) return
  opening = true
  open(mode.value, typed).finally(() => {
    opening = false
  })
}

// A character opens the form and goes into it; Enter just opens it. Tab and shortcuts pass by.
const onKeydown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return

  if (event.key === 'Enter') {
    event.preventDefault()
    start()
  } else if (event.key.length === 1) {
    event.preventDefault()
    start(event.key)
  }
}

const onPaste = (event: ClipboardEvent) => {
  event.preventDefault()
  start(event.clipboardData?.getData('text/plain') ?? '')
}
</script>

<template>
  <div
    class="sh-reply-box"
    :class="{ 'sh-reply-box--note': mode === 'note' }"
    role="group"
    :aria-label="$t('Reply')"
  >
    <textarea
      class="sh-reply-box__rest"
      rows="2"
      :placeholder="$t(placeholder, name)"
      :aria-label="$t(placeholder, name)"
      data-test-id="studenthub-reply-box-input"
      @click="start()"
      @keydown="onKeydown"
      @paste="onPaste"
    />
    <StudenthubReplyBoxFooter
      :mode="mode"
      :student="student"
      @mode="mode = $event"
      @attach="start()"
    />
  </div>
</template>
