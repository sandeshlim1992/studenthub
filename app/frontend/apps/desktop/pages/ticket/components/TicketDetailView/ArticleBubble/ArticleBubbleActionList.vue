<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import { useTicketArticleReplyAction } from '#shared/entities/ticket/composables/useTicketArticleReplyAction.ts'
import type { TicketArticle } from '#shared/entities/ticket/types.ts'
import { createArticleActions } from '#shared/entities/ticket-article/action/plugins/index.ts'
import { getArticleSelection } from '#shared/entities/ticket-article/composables/getArticleSelection.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import log from '#shared/utils/log.ts'

import CommonActionMenu from '#desktop/components/CommonActionMenu/CommonActionMenu.vue'
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'

const props = defineProps<{
  position: 'left' | 'right'
  article: TicketArticle
}>()

const { ticket, isTicketEditable, showTicketArticleReplyForm, form } = useTicketInformation()

const buttonVariantBaseClasses =
  'border! border-neutral-100! outline-transparent! hover:border-blue-700! text-gray-100! dark:border-gray-900! dark:text-neutral-400!'

const buttonVariantClassExtension = computed(() => {
  if (props.position === 'left')
    return `${buttonVariantBaseClasses} hover:border-blue-800! bg-neutral-50! hover:dark:bg-gray-500! hover:bg-white! dark:bg-gray-500!`

  return `${buttonVariantBaseClasses} dark:hover:border-blue-700! bg-blue-100! dark:bg-stone-500!`
})

const { getNewArticleBody, openReplyForm } = useTicketArticleReplyAction(
  form,
  showTicketArticleReplyForm,
)

const disposeCallbacks: (() => unknown)[] = []

const onDispose = (callback: () => unknown) => {
  disposeCallbacks.push(callback)
}

const handleDisposeCallbacks = () => {
  disposeCallbacks.forEach((callback) => callback())
  disposeCallbacks.length = 0
}

const recalculateTriggerId = ref(0)

const articleSelection = (articleInternalId: number) => {
  try {
    // Can throw RangeError.
    return getArticleSelection(articleInternalId)
  } catch (err) {
    log.error('[Article Quote] Failed to parse article selection', err)
    return undefined
  }
}

const QUICK_ACTION_NAMES = new Set(['changeVisibility', 'split', 'article-permalink'])

const getActionColorClass = (action: MenuItem & { key: string }) => {
  if (action.key === 'changeVisibility') {
    if (props.article.internal) {
      return 'text-amber-600 bg-amber-50/80 hover:bg-amber-100 hover:text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 dark:hover:bg-amber-900/50'
    }
    return 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white'
  }

  return 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-white'
}

const session = useSessionStore()
const isAgent = computed(() => session.hasPermission('ticket.agent'))

const actions = computed(() => {
  // Recalculation trigger ID cannot be less than 0, so it's just a hint for Vue to recalculate this computed property.
  if (!ticket.value || recalculateTriggerId.value < 0) {
    return {
      popoverActions: [],
      alwaysVisibleActions: [],
      quickActions: [],
      overflowActions: [],
    }
  }

  // Clear all side effects before recalculating actions.
  handleDisposeCallbacks()

  const articleActions = createArticleActions(ticket.value, props.article, 'desktop', {
    onDispose,
    recalculate: () => {
      recalculateTriggerId.value += 1
    },
  })

  const popoverActions: MenuItem[] = []
  const alwaysVisibleActions: MenuItem[] = []
  const quickActions: (MenuItem & { key: string })[] = []
  const overflowActions: MenuItem[] = []

  articleActions.forEach((action) => {
    // Student Hub: students only reply (no visibility, split, forward or copy actions).
    if (!isAgent.value && !/reply/i.test(action.name)) return

    const mappedAction = {
      key: action.name,
      label: action.label,
      icon: action.icon,
      link: action.link,
      ...(action.perform
        ? {
            onClick: () => {
              if (!ticket.value) return

              action.perform!(ticket.value, props.article, {
                formId: form.value?.formId ?? '',
                selection: articleSelection(props.article.internalId),
                openReplyForm,
                getNewArticleBody,
              })
            },
          }
        : {}),
    }

    if (action.alwaysVisible) {
      alwaysVisibleActions.push(mappedAction)
    } else {
      popoverActions.push(mappedAction)

      if (QUICK_ACTION_NAMES.has(action.name)) {
        quickActions.push(mappedAction)
      } else {
        overflowActions.push(mappedAction)
      }
    }
  })

  return {
    alwaysVisibleActions,
    quickActions,
    overflowActions,
    popoverActions,
  }
})
</script>

<template>
  <div
    v-if="isTicketEditable"
    class="article-bubble-actions absolute bottom-0 z-10 flex w-fit translate-y-1/2 items-center gap-1.5 ltr:right-3 rtl:left-3 print:hidden"
    :class="{ 'ltr:left-3 rtl:right-3': position === 'left' }"
  >
    <div
      v-for="action in actions.alwaysVisibleActions"
      :key="action.key"
      data-test-id="top-level-article-action-container"
      class="order-1 flex items-center"
      :class="position === 'right' ? 'order-first' : 'order-last'"
    >
      <CommonButton
        class="px-2 py-0.5! text-xs! font-medium rounded-full! focus-visible:outline-offset-0! focus-visible:outline-blue-800!"
        :class="buttonVariantClassExtension"
        :prefix-icon="action.icon"
        size="large"
        @click="action.onClick"
        >{{ $t(action.label) }}
      </CommonButton>
    </div>

    <!-- Segmented Quick Actions Pill Bar -->
    <div
      v-if="actions.quickActions.length || actions.overflowActions.length"
      class="flex items-center gap-0.5 rounded-full border border-slate-200/90 bg-white/95 p-0.5 shadow-xs backdrop-blur-md transition-all duration-200 hover:border-slate-300 hover:shadow-md dark:border-neutral-700/90 dark:bg-neutral-800/95 dark:hover:border-neutral-600"
      :class="position === 'right' ? 'order-last' : 'order-first'"
    >
      <template v-for="action in actions.quickActions" :key="action.key">
        <CommonLink
          v-if="action.link"
          v-tooltip="$t(action.label)"
          :link="action.link"
          :title="$t(action.label)"
          :aria-label="$t(action.label)"
          class="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-all hover:bg-slate-100 hover:text-blue-600 active:scale-95 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-blue-400"
        >
          <CommonIcon :name="action.icon" size="tiny" />
        </CommonLink>
        <button
          v-else
          v-tooltip="$t(action.label)"
          type="button"
          :title="$t(action.label)"
          :aria-label="$t(action.label)"
          class="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full transition-all active:scale-95"
          :class="getActionColorClass(action)"
          @click="action.onClick"
        >
          <CommonIcon :name="action.icon" size="tiny" />
        </button>
      </template>

      <div
        v-if="actions.quickActions.length && actions.overflowActions.length"
        class="mx-0.5 h-3.5 w-px bg-slate-200 dark:bg-neutral-700"
      />

      <CommonActionMenu
        v-if="actions.overflowActions.length"
        class="flex!"
        :entity="{ ticket, article }"
        button-size="small"
        :placement="position === 'left' ? 'arrowStart' : 'arrowEnd'"
        :default-button-variant="position === 'left' ? 'neutral-dark' : 'neutral-light'"
        :actions="actions.overflowActions"
        no-single-action-mode
        z-index="20"
      />
    </div>
  </div>
</template>
