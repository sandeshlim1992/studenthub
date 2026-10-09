<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useActiveElement, useLocalStorage, useWindowSize } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import ResizeLine from '#desktop/components/ResizeLine/ResizeLine.vue'
import { useResizeLine } from '#desktop/components/ResizeLine/useResizeLine.ts'
import { useStudenthubTicketReply } from '#desktop/pages/ticket/composables/useStudenthubTicketReply.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

import StudenthubReplyBoxFooter from './StudenthubReplyBoxFooter.vue'

import type { FormKitNode } from '@formkit/core'

interface Props {
  isPinned?: boolean
  hasInternalArticle?: boolean
  // Customers get a visible "Reply" heading inside the form (which carries the region's
  //  `aria-labelledby` id), so this panel omits its own sr-only heading for them.
  isTicketCustomer?: boolean
  // Student Hub: agents with the queue layout write in the reply box (design option A)
  studenthubBox?: boolean
  // … and students, without the switch to internal notes
  studenthubStudent?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'discard-form': []
  'toggle-pin': []
  submit: []
}>()

const DEFAULT_ARTICLE_PANEL_HEIGHT = 290
const MINIMUM_ARTICLE_PANEL_HEIGHT = 150

const { userId } = useSessionStore()

const articlePanelHeight = useLocalStorage(
  `${userId}-article-reply-height`,
  DEFAULT_ARTICLE_PANEL_HEIGHT,
)

const { height: screenHeight } = useWindowSize()

const articlePanelMaxHeight = computed(() => screenHeight.value / 2)

const resizeLine = ref<InstanceType<typeof ResizeLine>>()

const resizeCallback = (valueY: number) => {
  if (valueY >= articlePanelMaxHeight.value || valueY < MINIMUM_ARTICLE_PANEL_HEIGHT) return
  articlePanelHeight.value = valueY
}

const activeElement = useActiveElement()

const handleKeyStroke = (e: KeyboardEvent, adjustment: number) => {
  if (!articlePanelHeight.value || activeElement.value !== resizeLine.value?.resizeLine) return
  e.preventDefault()
  const newHeight = articlePanelHeight.value + adjustment
  if (newHeight >= articlePanelMaxHeight.value) return
  resizeCallback(newHeight)
}

const { startResizing } = useResizeLine(
  resizeCallback,
  resizeLine.value?.resizeLine,
  handleKeyStroke,
  { orientation: 'horizontal', offsetThreshold: 56 }, // bottom bar height in px
)

const resetHeight = () => {
  articlePanelHeight.value = DEFAULT_ARTICLE_PANEL_HEIGHT
}

const articlePanel = useTemplateRef<HTMLElement>('article-panel')

// ---- Student Hub reply box (design option A) ----
const { form } = useTicketInformation()
const { reply, replyAll, canReplyAll, addNote } = useStudenthubTicketReply()

const boxMode = computed(() => (props.hasInternalArticle ? 'note' : 'reply'))

// Reply all is offered while replying to an email that went to other people too.
const isReplyAll = ref(false)
watch(boxMode, (mode) => {
  if (mode === 'note') isReplyAll.value = false
})

const replyAllState = computed(() =>
  boxMode.value === 'reply' && canReplyAll.value ? isReplyAll.value : undefined,
)

const toggleReplyAll = (all: boolean) => {
  isReplyAll.value = all
  if (all) replyAll()
  else reply()
}

// Switching keeps the text (both keep the body Zammad already has).
const switchMode = (mode: 'reply' | 'note') => {
  if (mode === boxMode.value) return
  if (mode === 'note') addNote()
  else reply()
}

// Send is Update: the ticket fields changed in the Ticket panel are saved with the message.
const ticketChanges = computed(() => {
  void form?.value?.values
  const group = form?.value?.findNodeByName('ticket')
  return (group?.children ?? []).filter(
    (child) => 'context' in child && (child as FormKitNode).context?.state.dirty,
  ).length
})

const attach = () => {
  const node = form?.value?.getNodeByName('attachments')
  const input = articlePanel.value?.querySelector<HTMLInputElement>(
    `#${CSS.escape(String(node?.context?.id ?? ''))}, input[type="file"]`,
  )
  input?.click()
}

// Ctrl + Enter sends, Esc leaves the box and keeps the text.
const onBoxKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault()
    emit('submit')
  } else if (event.key === 'Escape' && !event.defaultPrevented) {
    ;(document.activeElement as HTMLElement | null)?.blur()
  }
}

onMounted(() => {
  if (props.isPinned || props.studenthubBox) return

  nextTick(() => {
    // NB: Give editor a chance to initialize its height.
    setTimeout(() => {
      articlePanel.value?.scrollIntoView?.(true)
    }, 300)
  })
})
</script>

<template>
  <div v-if="studenthubBox" ref="article-panel" class="relative">
    <h2 id="article-reply-form-title" class="sr-only">
      {{ $t('Reply') }}
    </h2>
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
    <div
      class="sh-reply-box sh-reply-box--open"
      :class="{
        'sh-reply-box--note': hasInternalArticle,
        'sh-reply-box--student': studenthubStudent,
      }"
      data-test-id="article-reply-stripes-panel"
      @keydown="onBoxKeydown"
    >
      <div id="ticketArticleReplyForm" class="sh-reply-box__form" />
      <StudenthubReplyBoxFooter
        :mode="boxMode"
        :ticket-changes="studenthubStudent ? 0 : ticketChanges"
        :reply-all="replyAllState"
        :student="studenthubStudent"
        writing
        @mode="switchMode"
        @reply-all="toggleReplyAll"
        @attach="attach"
        @send="$emit('submit')"
        @discard="$emit('discard-form')"
      />
    </div>
  </div>
  <div
    v-else
    ref="article-panel"
    class="mx-auto flex w-full flex-col"
    :class="{
      // Student Hub: students get the text box without the title row and its buttons
      'sh-reply-panel--student': isTicketCustomer,
      'overflow-hidden border-t border-t-neutral-300 bg-blue-200 dark:border-t-gray-900 dark:bg-gray-700':
        isPinned,
      'relative h-fit max-w-4xl py-4': !isPinned,
    }"
    :style="{
      height: isPinned ? `${articlePanelHeight}px` : undefined,
      '--top-header-height': isPinned ? '-1px' : undefined, // avoid joining with the header bottom border
    }"
  >
    <ResizeLine
      v-if="isPinned"
      ref="resizeLine"
      class="group absolute top-0 z-10 h-3 w-full"
      :label="$t('Resize article panel')"
      orientation="horizontal"
      :values="{
        max: articlePanelMaxHeight,
        min: MINIMUM_ARTICLE_PANEL_HEIGHT,
        current: articlePanelHeight,
      }"
      @mousedown-event="startResizing"
      @touchstart-event="startResizing"
      @dblclick="resetHeight"
    />
    <h2 v-if="!isTicketCustomer" id="article-reply-form-title" class="sr-only">
      {{ $t('Reply') }}
    </h2>
    <div class="flex h-full min-h-0 grow flex-col">
      <div
        class="mx-auto flex h-full w-full max-w-4xl grow flex-col px-12"
        :class="{ 'py-3': isPinned }"
      >
        <div class="flex h-full grow flex-col" data-test-id="article-reply-stripes-panel">
          <!-- Positioning wrapper for the actions overlay. The reply box border + background live on
               the header and body inside the form: the header keeps the normal border (rounded
               top), the body continues it (public) or replaces it with the stripe (internal) — see
               useTicketEditForm. -->
          <div class="relative isolate flex h-full grow flex-col">
            <!-- Overlaid on the trailing end of the channel/visibility row. `top-2` matches the header's `py-2`,
                 and the height depends on the user permissions, so the actions are vertically aligned. -->
            <div
              v-if="!isTicketCustomer"
              class="absolute inset-e-3 top-2 z-20 flex items-center gap-2"
              :class="{
                'h-6': isTicketCustomer,
                'h-10': !isTicketCustomer,
              }"
            >
              <CommonButton
                v-tooltip="$t('Discard unsaved reply')"
                class="cursor-pointer text-red-500 hover:bg-red-50 hover:text-red-600 hover:outline-transparent! focus:outline-transparent! dark:hover:bg-red-950/40"
                variant="none"
                :size="isTicketCustomer ? 'small' : 'large'"
                icon="trash"
                @click="$emit('discard-form')"
              />
              <CommonButton
                v-tooltip="isPinned ? $t('Unpin this panel') : $t('Pin this panel')"
                :icon="isPinned ? 'pin' : 'pin-angle'"
                class="cursor-pointer hover:outline-transparent! focus:outline-transparent!"
                :class="
                  isPinned
                    ? 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-400'
                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white'
                "
                variant="none"
                :size="isTicketCustomer ? 'small' : 'large'"
                @click="$emit('toggle-pin')"
              />
            </div>
            <div id="ticketArticleReplyForm" class="h-full grow" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
