<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'

import type { StudenthubReplyMode } from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'

// Student Hub: the top of the agents' reply box (design option 1), the same at rest and while
// writing: what the message is, as tabs. Switching keeps the text. Phone call is offered when the
// ticket allows phone messages.
interface Props {
  mode: StudenthubReplyMode
  phone?: boolean
  disabled?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  mode: [StudenthubReplyMode]
}>()

const tabs = computed(() => {
  const list: { mode: StudenthubReplyMode; label: string; icon: string }[] = [
    { mode: 'reply', label: __('Reply'), icon: 'reply' },
    { mode: 'note', label: __('Internal note'), icon: 'pencil-square' },
  ]
  if (props.phone) list.push({ mode: 'phone', label: __('Phone call'), icon: 'telephone' })
  return list
})

const tabList = useTemplateRef<HTMLElement>('tab-list')

// Arrow keys, Home and End move between the tabs and pick the one they land on.
const onKeydown = (event: KeyboardEvent) => {
  const index = tabs.value.findIndex((tab) => tab.mode === props.mode)
  const last = tabs.value.length - 1
  const next = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  }[event.key]

  if (next === undefined) return
  event.preventDefault()
  emit('mode', tabs.value[next].mode)
  nextTick(() => tabList.value?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus())
}
</script>

<template>
  <!-- eslint-disable-next-line vuejs-accessibility/interactive-supports-focus -->
  <div
    ref="tab-list"
    class="sh-reply-tabs"
    role="tablist"
    :aria-label="$t('Message type')"
    @keydown="onKeydown"
  >
    <button
      v-for="tab in tabs"
      :key="tab.mode"
      type="button"
      role="tab"
      class="sh-reply-tabs__tab"
      :class="`sh-reply-tabs__tab--${tab.mode}`"
      :aria-selected="mode === tab.mode"
      :tabindex="mode === tab.mode ? 0 : -1"
      :disabled="disabled"
      :data-test-id="`studenthub-reply-tab-${tab.mode}`"
      @click="$emit('mode', tab.mode)"
    >
      <CommonIcon :name="tab.icon" size="xs" decorative />
      {{ $t(tab.label) }}
    </button>
  </div>
</template>
