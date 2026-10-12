// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref, watch, type ComputedRef } from 'vue'

import type { TicketById } from '#shared/entities/ticket/types.ts'
import { convertToGraphQLId, getIdFromGraphQLId } from '#shared/graphql/utils.ts'

// Student Hub: the checklist a ticket's Category › Sub-category gets (Studenthub::ChecklistAssignments,
// GET /api/v1/studenthub/checklist_assignments/ticket/:id), offered on the Checklist tab while the
// ticket has none: tickets that were in that sub-category before the assignment get it in one click.

export interface StudenthubChecklistSuggestion {
  templateId: string
  name: string
  category: string
  subCategory: string
}

const CATEGORY_FIELD = 'category2'
const SUB_CATEGORY_FIELD = 'subcategory'

export const loadStudenthubChecklistSuggestion = async (
  ticketId: string,
): Promise<StudenthubChecklistSuggestion | null> => {
  const response = await fetch(
    `/api/v1/studenthub/checklist_assignments/ticket/${getIdFromGraphQLId(ticketId)}`,
    {
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    },
  )
  if (!response.ok) return null

  const data = await response.json()
  if (!data?.checklist_template_id) return null

  return {
    templateId: convertToGraphQLId('ChecklistTemplate', data.checklist_template_id),
    name: data.name,
    category: data.category,
    subCategory: data.sub_category,
  }
}

export const useStudenthubChecklistSuggestion = (
  ticket: ComputedRef<TicketById | undefined>,
  // Asked only once the ticket's checklist is loaded and missing.
  withoutChecklist: ComputedRef<boolean>,
) => {
  const suggestion = ref<StudenthubChecklistSuggestion | null>(null)

  const fieldValue = (name: string) =>
    ticket.value?.objectAttributeValues?.find((entry) => entry.attribute.name === name)?.value

  // Asked again when the ticket moves to another Category › Sub-category.
  const pair = computed(
    () => `${fieldValue(CATEGORY_FIELD) ?? ''}›${fieldValue(SUB_CATEGORY_FIELD) ?? ''}`,
  )

  let latestRequest = 0

  watch(
    () => [ticket.value?.id, withoutChecklist.value, pair.value] as const,
    ([ticketId, missing]) => {
      latestRequest += 1
      const request = latestRequest
      suggestion.value = null
      if (!ticketId || !missing) return

      loadStudenthubChecklistSuggestion(ticketId)
        .then((result) => {
          if (request === latestRequest) suggestion.value = result
        })
        .catch(() => {
          if (request === latestRequest) suggestion.value = null
        })
    },
    { immediate: true },
  )

  return { suggestion }
}
