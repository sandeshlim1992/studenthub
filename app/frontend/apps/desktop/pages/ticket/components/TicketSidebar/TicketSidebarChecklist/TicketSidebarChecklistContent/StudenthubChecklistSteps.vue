<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, useId, useTemplateRef } from 'vue'

import { useHtmlLinks } from '#shared/composables/useHtmlLinks.ts'
import { EnumTicketStateColorCode, type ChecklistItem } from '#shared/graphql/types.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { textToHtml } from '#shared/utils/helpers.ts'

import CommonTicketLabel from '#desktop/components/CommonTicketLabel/CommonTicketLabel.vue'

// Student Hub: the checklist as steps on a timeline (design B of the Checklist tab board). Agents
// only tick and untick (Studenthub::ChecklistRules); the next open step carries "Mark done", done
// steps show who last changed them and when. Linked tickets count as done once closed.

interface Props {
  items: ChecklistItem[]
  readOnly?: boolean
  updatingItemIds: Set<ID>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'set-item-checked': [ChecklistItem]
}>()

const isDone = (item: ChecklistItem) =>
  item.ticketReference
    ? item.ticketReference.ticket?.stateColorCode === EnumTicketStateColorCode.Closed
    : item.checked

// Unique per tab: several ticket screens stay open (kept alive) at the same time.
const uid = useId()

const steps = computed(() => {
  const nextIndex = props.items.findIndex((item) => !item.ticketReference && !item.checked)

  return props.items.map((item, index) => {
    const done = isDone(item)
    const following = props.items[index + 1]

    return {
      item,
      done,
      isNext: index === nextIndex,
      inputId: `${uid}-step-${index}`,
      testId: `checklist-step-${item.id ? getIdFromGraphQLId(item.id) : index + 1}`,
      lineDone: done && !!following && isDone(following),
      isUpdating: props.updatingItemIds.has(item.id),
    }
  })
})

const setChecked = (item: ChecklistItem, checked: boolean) => {
  if (props.readOnly || props.updatingItemIds.has(item.id)) return

  emit('set-item-checked', { ...item, checked })
}

const list = useTemplateRef('list')
const { setupLinksHandlers } = useHtmlLinks('')

onMounted(() => {
  if (list.value) setupLinksHandlers(list.value)
})
</script>

<template>
  <div ref="list">
  <ol class="m-0 flex list-none flex-col p-0">
    <li
      v-for="(step, index) in steps"
      :key="step.item.id ?? index"
      class="flex gap-3"
      :class="{ 'opacity-60': step.isUpdating }"
      :data-test-id="step.testId"
    >
      <div class="flex w-[22px] shrink-0 flex-col items-center">
        <span
          v-if="step.item.ticketReference"
          class="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full"
          :class="
            step.done
              ? 'bg-[var(--sh-app)]'
              : 'border-2 border-[#c4c9d1] bg-white dark:border-gray-200 dark:bg-gray-500'
          "
          aria-hidden="true"
        >
          <CommonIcon v-if="step.done" name="check2" size="xs" class="text-white" decorative />
        </span>
        <label
          v-else
          :for="step.inputId"
          class="flex shrink-0"
          :class="{ 'cursor-pointer': !readOnly }"
        >
          <input
            :id="step.inputId"
            type="checkbox"
            class="peer sr-only"
            :checked="step.item.checked"
            :disabled="readOnly || step.isUpdating"
            @change="setChecked(step.item, ($event.target as HTMLInputElement).checked)"
          />
          <span
            class="flex h-[22px] w-[22px] items-center justify-center rounded-full peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--sh-app)]"
            :class="[
              step.done
                ? 'bg-[var(--sh-app)]'
                : step.isNext
                  ? 'border-2 border-[var(--sh-app)] bg-white dark:bg-gray-500'
                  : 'border-2 border-[#c4c9d1] bg-white dark:border-gray-200 dark:bg-gray-500',
              { 'hover:border-[var(--sh-app)]': !readOnly && !step.done },
            ]"
          >
            <CommonIcon v-if="step.done" name="check2" size="xs" class="text-white" decorative />
          </span>
          <span class="sr-only">{{ step.item.text }}</span>
        </label>
        <span
          v-if="index < steps.length - 1"
          class="min-h-3.5 w-0.5 grow"
          :class="step.lineDone ? 'bg-[var(--sh-app)]' : 'bg-[#d4d8de] dark:bg-gray-200'"
        />
      </div>

      <div class="flex min-w-0 grow flex-col gap-0.5 pt-px pb-3.5">
        <span
          v-if="step.isNext"
          class="text-[11px] font-bold tracking-wider text-[var(--sh-app)] uppercase dark:text-white"
          >{{ $t('Next') }}</span
        >
        <div v-if="step.item.ticketReference" class="flex flex-col gap-0.5">
          <CommonTicketLabel
            :unauthorized="!step.item.ticketReference.ticket"
            :ticket="step.item.ticketReference.ticket"
          />
          <span class="text-xs text-[var(--sh-muted)] dark:text-neutral-400">
            {{ step.done ? $t('Linked ticket, closed') : $t('Linked ticket, done once it is closed') }}
          </span>
        </div>
        <!-- eslint-disable vue/no-v-html -- textToHtml escapes the text and only adds links -->
        <span
          v-else
          class="text-sm break-words"
          :class="
            step.isNext
              ? 'font-semibold'
              : step.done
                ? ''
                : 'text-[#3b4352] dark:text-neutral-400'
          "
          v-html="textToHtml(step.item.text || '-')"
        />
        <!-- eslint-enable vue/no-v-html -->
        <span
          v-if="step.done && !step.item.ticketReference && step.item.updatedBy"
          class="text-xs text-[var(--sh-muted)] dark:text-neutral-400"
        >
          {{ step.item.updatedBy.fullname }} ·
          <CommonDateTime :date-time="step.item.updatedAt" type="relative" />
        </span>
        <button
          v-if="step.isNext && !readOnly"
          type="button"
          class="mt-2 h-8 self-start rounded-md bg-[var(--sh-app)] px-3 text-[13px] font-semibold text-[var(--sh-on-app)] hover:bg-[var(--sh-app-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sh-app)] disabled:opacity-60"
          :disabled="step.isUpdating"
          @click="setChecked(step.item, true)"
        >
          {{ $t('Mark done') }}
        </button>
      </div>
    </li>
  </ol>
  </div>
</template>
