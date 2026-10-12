<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script lang="ts" setup>
import { computed, ref } from 'vue'

import { useConfirmation } from '#shared/composables/useConfirmation.ts'
import { handleUserErrors } from '#shared/errors/utils.ts'
import type { ChecklistItem, TicketChecklistItemInput } from '#shared/graphql/types.ts'
import { i18n } from '#shared/i18n/index.ts'
import { getApolloClient } from '#shared/server/apollo/client.ts'
import { MutationHandler } from '#shared/server/apollo/handler/index.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import type { ObjectLike } from '#shared/types/utils.ts'

import CommonLoader from '#desktop/components/CommonLoader/CommonLoader.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import StudenthubChecklistSteps from '#desktop/pages/ticket/components/TicketSidebar/TicketSidebarChecklist/TicketSidebarChecklistContent/StudenthubChecklistSteps.vue'
import TicketSidebarChecklistContentSkeleton from '#desktop/pages/ticket/components/TicketSidebar/TicketSidebarChecklist/TicketSidebarChecklistContentSkeleton.vue'
import { useStudenthubChecklistSuggestion } from '#desktop/pages/ticket/components/TicketSidebar/TicketSidebarChecklist/useStudenthubChecklistSuggestion.ts'
import { useTicketChecklist } from '#desktop/pages/ticket/components/TicketSidebar/TicketSidebarChecklist/useTicketChecklist.ts'
import TicketSidebarContent from '#desktop/pages/ticket/components/TicketSidebar/TicketSidebarContent.vue'
import { useTicketInformation } from '#desktop/pages/ticket/composables/useTicketInformation.ts'
import { useTicketNumber } from '#desktop/pages/ticket/composables/useTicketNumber.ts'
import { useTicketChecklistAddMutation } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistAdd.api.ts'
import { useTicketChecklistDeleteMutation } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistDelete.api.ts'
import { useTicketChecklistItemUpsertMutation } from '#desktop/pages/ticket/graphql/mutations/ticketChecklistItemUpsert.api.ts'
import type { TicketSidebarContentProps } from '#desktop/pages/ticket/types/sidebar.ts'

// Student Hub: design B of the Checklist tab board. Checklists are made and assigned by admins
// (Studenthub::ChecklistRules, Studenthub::ChecklistAssignments): agents only tick and untick, and a
// ticket without one is offered only the checklist of its Category › Sub-category. Checklist admins
// can still remove a checklist; everything else is changed under Administration › Checklists.

defineProps<TicketSidebarContentProps>()

const persistentStates = defineModel<ObjectLike>({ required: true })

const { cache: apolloCache } = getApolloClient()
const { ticket, ticketId, isTicketEditable } = useTicketInformation()
const { ticketNumberWithTicketHook } = useTicketNumber(ticket)
const { hasPermission } = useSessionStore()

const canManage = computed(() => isTicketEditable.value && hasPermission('admin.checklist'))

const { checklist, isLoadingChecklist } = useTicketChecklist(ticketId)

const { suggestion: checklistSuggestion, categoryPath } = useStudenthubChecklistSuggestion(
  ticket,
  computed(() => !isLoadingChecklist.value && !checklist.value),
)

const checklistTitle = computed(
  () => checklist.value?.name || i18n.t('%s Checklist', ticketNumberWithTicketHook.value),
)

const doneCount = computed(() => {
  const total = checklist.value?.items.length ?? 0
  return Math.max(total - (checklist.value?.incomplete ?? total), 0)
})

const stateChip = computed(() => {
  const total = checklist.value?.items.length ?? 0
  const done = doneCount.value

  if (total > 0 && done === total)
    return {
      label: i18n.t('Done · %s of %s', done, total),
      classes: 'bg-[#dcfce7] text-[#14532d]',
    }
  if (done > 0)
    return {
      label: i18n.t('In progress · %s of %s', done, total),
      classes: 'bg-[#fef3c7] text-[#78350f]',
    }
  return {
    label: i18n.t('Not started · %s of %s', done, total),
    classes: 'bg-[#eef0f3] text-[#3b4352] dark:bg-gray-500 dark:text-neutral-400',
  }
})

const addNewChecklistMutation = new MutationHandler(useTicketChecklistAddMutation())
const isAddingNewChecklist = addNewChecklistMutation.loading()

const addSuggestedChecklist = () => {
  if (!ticket.value?.id || !checklistSuggestion.value) return

  addNewChecklistMutation
    .send({ ticketId: ticket.value.id, templateId: checklistSuggestion.value.templateId })
    .catch(handleUserErrors)
}

const checklistDeleteMutation = new MutationHandler(useTicketChecklistDeleteMutation())

const removeChecklist = async () => {
  const { waitForVariantConfirmation } = useConfirmation()

  const confirmed = await waitForVariantConfirmation('delete')

  if (confirmed)
    await checklistDeleteMutation
      .send({
        checklistId: checklist.value?.id as string,
      })
      .catch(handleUserErrors)
}

const itemUpsertMutation = new MutationHandler(useTicketChecklistItemUpsertMutation(), {
  errorNotificationMessage: __('Failed to update checklist item.'),
})

const updatingItemIds = ref<Set<ID>>(new Set())

const modifyIncompleteItemCountCache = (increase: boolean) => {
  const currentCheckList = checklist.value!
  const previousIncompleteItemCount = currentCheckList.incomplete
  const previousCompleted = currentCheckList.completed

  let incompleteItemCount = currentCheckList.incomplete ?? 0

  // Update the incomplete item count based on the mutated checked state, not waiting for the subscription to kick in.
  //   The recalculation below does not take into account any ticket checklist items and their state.
  //   Their change will update the incomplete item count via the subscription update after a short delay.
  if (increase) incompleteItemCount += 1
  else incompleteItemCount -= 1

  if (incompleteItemCount < 0 || !currentCheckList.items) incompleteItemCount = 0
  else if (incompleteItemCount > currentCheckList.items.length)
    incompleteItemCount = currentCheckList.items.length

  const checklistId = apolloCache.identify(currentCheckList)

  apolloCache.modify({
    id: checklistId,
    fields: {
      incomplete() {
        return incompleteItemCount
      },
      total() {
        return currentCheckList.items.length
      },
      completed() {
        return incompleteItemCount === 0
      },
      complete() {
        return currentCheckList.items.length - incompleteItemCount
      },
    },
  })

  // Return function to restore cache to the previous state.
  return () => {
    apolloCache.modify({
      id: checklistId,
      fields: {
        incomplete() {
          return previousIncompleteItemCount
        },
        completed() {
          return previousCompleted
        },
        total() {
          return currentCheckList.items.length
        },
        complete() {
          return currentCheckList.items.length - previousIncompleteItemCount
        },
      },
    })
  }
}

const modifyCheckedCache = (item: ChecklistItem) => {
  const checklistItemId = apolloCache.identify(item)

  apolloCache.modify({
    id: checklistItemId,
    fields: {
      checked() {
        return item.checked
      },
    },
  })

  const restoreIncompleteItemCountCache = modifyIncompleteItemCountCache(!item.checked)

  // Return function to restore cache to the previous state.
  return () => {
    restoreIncompleteItemCountCache()

    apolloCache.modify({
      id: checklistItemId,
      fields: {
        checked() {
          return !item.checked
        },
      },
    })
  }
}

const updateItem = async (itemId: string, input: TicketChecklistItemInput) =>
  itemUpsertMutation.send({
    checklistId: checklist.value?.id as string,
    checklistItemId: itemId,
    input,
  })

const setItemCheckedState = async (item: ChecklistItem) => {
  const restoreCache = modifyCheckedCache(item)

  updatingItemIds.value.add(item.id)

  await updateItem(item.id, { checked: item.checked })
    .catch((error) => {
      restoreCache()
      handleUserErrors(error)
    })
    .finally(() => {
      updatingItemIds.value.delete(item.id)
    })
}

const checklistActions: MenuItem[] = [
  {
    key: 'remove',
    label: __('Remove checklist'),
    variant: 'danger',
    icon: 'trash3',
    onClick: () => removeChecklist(),
    show: () => !!checklist.value,
  },
]
</script>

<template>
  <TicketSidebarContent
    v-model="persistentStates.scrollPosition"
    :actions="canManage ? checklistActions : undefined"
    :title="sidebarPlugin.title"
    :icon="sidebarPlugin.icon"
  >
    <CommonLoader :loading="isLoadingChecklist">
      <template #skeleton>
        <TicketSidebarChecklistContentSkeleton />
      </template>

      <div
        v-if="checklist"
        class="flex flex-col gap-3.5 text-sm text-[var(--sh-ink)] dark:text-white"
        data-test-id="studenthubChecklist"
      >
        <div>
          <span
            class="inline-flex h-6 items-center rounded-full px-2.5 text-xs font-bold"
            :class="stateChip.classes"
            >{{ stateChip.label }}</span
          >
        </div>

        <h3 class="m-0 text-[15px] font-semibold">{{ checklistTitle }}</h3>

        <StudenthubChecklistSteps
          v-if="checklist.items.length"
          :items="checklist.items"
          :read-only="!isTicketEditable"
          :updating-item-ids="updatingItemIds"
          @set-item-checked="setItemCheckedState"
        />
        <p v-else class="m-0 text-[var(--sh-muted)] dark:text-neutral-400">
          {{ $t('This checklist has no items.') }}
        </p>

        <p class="m-0 text-xs leading-normal text-[var(--sh-muted)] dark:text-neutral-400">
          {{ categoryPath ? $t('Set by your admins for %s.', categoryPath) : $t('Set by your admins.') }}
          <template v-if="isTicketEditable">{{
            $t('Tick steps as you go; a done step can be unticked.')
          }}</template>
        </p>
      </div>

      <div v-else class="flex flex-col gap-4 text-sm text-[var(--sh-ink)] dark:text-white">
        <p
          class="m-0 flex items-start gap-2.5 text-[13px] leading-normal text-[var(--sh-muted)] dark:text-neutral-400"
        >
          <CommonIcon name="checklist" size="xs" class="mt-0.5 shrink-0" decorative />
          <span v-if="checklistSuggestion">{{ $t('This ticket has no checklist yet.') }}</span>
          <span v-else-if="categoryPath">{{ $t('No checklist for %s.', categoryPath) }}</span>
          <span v-else>{{ $t('No checklist assigned to this ticket.') }}</span>
        </p>

        <template v-if="checklistSuggestion && isTicketEditable">
          <section
            class="flex flex-col gap-3 rounded-[10px] border border-[var(--sh-app-border)] bg-white p-3.5 dark:border-gray-900 dark:bg-gray-500"
            :aria-label="$t('Suggested checklist')"
          >
            <div class="flex flex-col gap-1">
              <span
                class="text-[11px] font-bold tracking-wider text-[var(--sh-app)] uppercase dark:text-white"
                >{{ $t('Suggested for this sub-category') }}</span
              >
              <span class="text-xs text-[var(--sh-muted)] dark:text-neutral-400">
                {{ checklistSuggestion.category }} › {{ checklistSuggestion.subCategory }}
              </span>
            </div>
            <div class="flex flex-col gap-0.5">
              <p class="m-0 text-[15px] font-semibold">{{ checklistSuggestion.name }}</p>
              <span class="text-xs text-[var(--sh-muted)] dark:text-neutral-400">
                {{ $t('%s items', checklistSuggestion.itemCount) }}
              </span>
            </div>
            <ul
              v-if="checklistSuggestion.firstItems.length"
              class="m-0 flex list-none flex-col gap-1.5 rounded-lg bg-[#f6f7f9] px-3 py-2.5 text-[13px] text-[#3b4352] dark:bg-gray-700 dark:text-neutral-400"
            >
              <li
                v-for="(text, index) in checklistSuggestion.firstItems"
                :key="index"
                class="flex items-center gap-2"
              >
                <span
                  class="h-3 w-3 shrink-0 rounded-[3px] border-[1.5px] border-[#9aa1ad]"
                  aria-hidden="true"
                />
                {{ text }}
              </li>
              <li
                v-if="checklistSuggestion.itemCount > checklistSuggestion.firstItems.length"
                class="ps-5 text-xs text-[var(--sh-muted)] dark:text-neutral-400"
              >
                {{
                  $t(
                    'and %s more',
                    checklistSuggestion.itemCount - checklistSuggestion.firstItems.length,
                  )
                }}
              </li>
            </ul>
            <button
              type="button"
              class="h-10 rounded-md bg-[var(--sh-app)] text-sm font-semibold text-[var(--sh-on-app)] hover:bg-[var(--sh-app-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sh-app)] disabled:opacity-60"
              :disabled="isAddingNewChecklist"
              @click="addSuggestedChecklist"
            >
              {{ $t('Add this checklist') }}
            </button>
          </section>
          <p class="m-0 text-xs leading-normal text-[var(--sh-muted)] dark:text-neutral-400">
            {{
              $t(
                'New tickets in this sub-category get it automatically; this card shows on tickets that were here before.',
              )
            }}
          </p>
        </template>
      </div>
    </CommonLoader>
  </TicketSidebarContent>
</template>
