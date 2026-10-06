// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub Ticket Approvals: whether the signed-in user is a manager without another staff
// role (GET /api/v1/ticket_approval/viewer). Such managers only approve: the ticket screen
// leaves out the sidebar icons and shows the decision under the messages. Asked once per user.

import { computed, ref } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'

interface Viewer {
  enabled: boolean
  manager_only: boolean
}

const viewer = ref<Viewer | null>(null)
const loadedFor = ref<string | null>(null)
let requestedFor: string | null = null

const load = (userId: string) => {
  requestedFor = userId
  loadedFor.value = null
  // fetch can throw at once (tests), so start it inside the promise chain.
  Promise.resolve()
    .then(() =>
      fetch('/api/v1/ticket_approval/viewer', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    .then((response) => (response.ok ? response.json() : null))
    .then((data: Viewer | null) => data)
    .catch(() => null)
    .then((data) => {
      if (requestedFor !== userId) return
      viewer.value = data
      loadedFor.value = userId
    })
}

export const useStudenthubApprovalViewer = () => {
  const session = useSessionStore()
  const { userId } = session

  // Only managers can be managers-only; everyone else needs no request.
  const isApprover = computed(() => session.hasPermission('ticket.approver'))

  if (isApprover.value && userId && requestedFor !== userId) load(userId)

  const isLoaded = computed(() => !isApprover.value || loadedFor.value === session.userId)

  const isManagerOnly = computed(
    () => isApprover.value && loadedFor.value === session.userId && !!viewer.value?.manager_only,
  )

  return { isApprover, isLoaded, isManagerOnly }
}
