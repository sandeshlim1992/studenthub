<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'

import { useStudenthubCustomerTicket } from '../../composable/useStudenthubCustomerTicket.ts'

// Student Hub: the student's chat box under the conversation, in place of the Add reply button.
// A message to a resolved or closed request reopens it (the server decides); files go through
// Zammad's reply form, which handles uploads.
interface Props {
  canAttach: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  attach: []
}>()

const { overview, isBusy, isNotSolved, run } = useStudenthubCustomerTicket()

const message = ref('')
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea')

const stage = computed(() => overview.value?.progress.stage)
const isClosed = computed(() => stage.value === 'resolved' || stage.value === 'closed')
const cannotReopen = computed(() => Boolean(overview.value?.actions.new_ticket))
const canSend = computed(() => message.value.trim().length > 0 && !isBusy.value)

const placeholder = computed(() =>
  isNotSolved.value ? __('Tell us what is still not working…') : __('Write a message…'),
)

// Grows with the message up to about five lines, as chat apps do.
const MAX_HEIGHT = 120

watch(message, async () => {
  await nextTick()
  if (!textarea.value) return

  textarea.value.style.height = 'auto'
  textarea.value.style.height = `${Math.min(textarea.value.scrollHeight, MAX_HEIGHT)}px`
})

watch(isNotSolved, async (notSolved) => {
  if (!notSolved) return

  await nextTick()
  textarea.value?.focus()
})

const send = async () => {
  if (!canSend.value) return
  if (!(await run('reply', { message: message.value }))) return

  message.value = ''
  isNotSolved.value = false
}
</script>

<template>
  <div
    class="fixed bottom-0 z-10 border-t-[0.5px] border-white/10 bg-gray-600 px-3 pt-2 pb-safe-1 ltr:right-0 ltr:left-0 rtl:right-0 rtl:left-0"
    data-test-id="studenthub-chat-composer"
  >
    <div v-if="cannotReopen" class="flex flex-col items-center gap-2 pb-2 text-center text-sm">
      <p>
        {{
          $t(
            'This request is closed and cannot be reopened. Raise a new ticket if you still need help.',
          )
        }}
      </p>
      <CommonLink
        class="flex h-11 items-center rounded-xl bg-blue px-4 font-bold text-white"
        link="/tickets/request"
      >
        {{ $t('New ticket') }}
      </CommonLink>
    </div>

    <template v-else>
      <p v-if="isClosed" class="pb-2 text-center text-xs text-gray">
        {{ $t('Sending a message opens this request again.') }}
      </p>
      <form class="flex items-end gap-2 pb-2" @submit.prevent="send">
        <button
          v-if="canAttach"
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gray-400"
          type="button"
          :aria-label="$t('Attach a file')"
          @click="emit('attach')"
        >
          <CommonIcon name="attachment" size="base" decorative />
        </button>
        <textarea
          ref="textarea"
          v-model="message"
          class="min-h-11 min-w-0 flex-1 resize-none rounded-xl border border-gray-300 bg-black px-3 py-2.5 text-base leading-5 outline-none focus:border-blue"
          rows="1"
          :aria-label="$t('Message')"
          :placeholder="$t(placeholder)"
        ></textarea>
        <button
          class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue text-white disabled:opacity-50"
          type="submit"
          :disabled="!canSend"
          :aria-label="$t('Send')"
        >
          <CommonIcon name="arrow-up" size="base" decorative />
        </button>
      </form>
    </template>
  </div>
</template>
