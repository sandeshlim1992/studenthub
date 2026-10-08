// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ref, type Ref } from 'vue'

import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

// Student Hub: the feedback a customer gave on a ticket (GET /api/v1/feedback_collection/tickets/:id).

export interface TicketFeedback {
  id: number
  rating: number
  comments: string | null
  rated_at: string
  customer_name: string | null
  owner_name: string | null
}

export const useTicketFeedback = (ticketId: Ref<string | number | undefined>) => {
  const items = ref<TicketFeedback[]>([])
  const isLoading = ref(false)
  const hasFailed = ref(false)

  const load = async () => {
    if (!ticketId.value) return

    isLoading.value = true
    try {
      const data = await studenthubApi<{ items: TicketFeedback[] }>(`/api/v1/feedback_collection/tickets/${ticketId.value}`)
      items.value = data.items ?? []
      hasFailed.value = false
    } catch {
      hasFailed.value = true
    } finally {
      isLoading.value = false
    }
  }

  return { items, isLoading, hasFailed, load }
}
