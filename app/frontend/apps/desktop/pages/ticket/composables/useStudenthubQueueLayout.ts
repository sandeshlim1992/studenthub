// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'

// Student Hub: agents and admins work on a ticket with the queue beside it, a compact header, the
// reply bar and the panels as tabs on the right (design option B). Students and managers without
// another staff role keep the Details column on the left; the Managers role carries ticket.agent,
// so the server tells managers-only apart (isLoaded is false until it has).
export const useStudenthubQueueLayout = () => {
  const session = useSessionStore()
  const { isLoaded, isManagerOnly } = useStudenthubApprovalViewer()

  const isQueueLayout = computed(
    () => session.hasPermission('ticket.agent') && !isManagerOnly.value,
  )

  return { isLoaded, isQueueLayout }
}
