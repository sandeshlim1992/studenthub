// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub Ticket Approvals on the staff "New ticket" screen: "Send for approval" (off by
// default) with a manager and a reason. The fields are ordinary form fields; the ticket create
// ignores them, and the request is sent once the ticket exists (POST /tickets/:id/approval).

import { computed, ref, watch, type Ref } from 'vue'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

export const APPROVAL_SEND_FIELD = 'studenthub_send_for_approval'
export const APPROVAL_MANAGER_FIELD = 'studenthub_approver_id'
export const APPROVAL_REASON_FIELD = 'studenthub_approval_reason'
// Not an approval field, but kept out of the ticket the same way: marks a saved draft.
export const STUDENTHUB_DRAFT_FIELD = 'studenthub_saved_draft'

interface Manager {
  id: number
  name: string
}

export interface StudenthubCreateApprovalValues {
  send: boolean
  approverId: number
  reason: string
}

const headers = (withBody = false) => {
  const result: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (withBody) {
    result['Content-Type'] = 'application/json'
    const token = getCSRFToken()
    if (token) result['X-CSRF-Token'] = token
  }
  return result
}

// Every manager can be chosen, whatever the team: the ticket waits in the Managers group, where
// only the chosen manager (and the agent) can open it.
export const useStudenthubCreateApproval = (isAvailable: Ref<boolean>) => {
  const managers = ref<Manager[]>([])
  const isLoaded = ref(false)

  const load = () =>
    // fetch can throw at once (tests), so start it inside the promise chain.
    Promise.resolve()
      .then(() =>
        fetch('/api/v1/ticket_approval/managers', { credentials: 'same-origin', headers: headers() }),
      )
      .then((response) => (response.ok ? response.json() : { managers: [] }))
      .then((data: { managers?: Manager[] }) => {
        managers.value = data.managers ?? []
      })
      .catch(() => {
        managers.value = []
      })
      .finally(() => {
        isLoaded.value = true
      })

  watch(
    isAvailable,
    (available) => {
      if (available && !isLoaded.value) load()
    },
    { immediate: true },
  )

  const managerOptions = computed(() =>
    managers.value.map((manager) => ({ value: manager.id, label: manager.name })),
  )

  const managerHint = computed(() =>
    isLoaded.value && !managerOptions.value.length
      ? __('Nobody has the Managers role yet. An admin gives it to the managers.')
      : undefined,
  )

  const { notify } = useNotifications()

  // Called after the ticket was created.
  const sendForApproval = async (ticketId: number, approval: StudenthubCreateApprovalValues) => {
    try {
      const response = await fetch(`/api/v1/tickets/${ticketId}/approval`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: headers(true),
        body: JSON.stringify({ approver_id: approval.approverId, reason: approval.reason }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || `${response.status}`)
      }
      notify({
        id: 'studenthub-create-approval',
        type: NotificationTypes.Success,
        message: __('Ticket sent for approval.'),
      })
    } catch (error) {
      notify({
        id: 'studenthub-create-approval',
        type: NotificationTypes.Error,
        message: __(
          'The ticket was created, but it could not be sent for approval (%s). Send it from the Approval tab.',
        ),
        messagePlaceholder: [error instanceof Error ? error.message : String(error)],
      })
    }
  }

  return { managerOptions, managerHint, sendForApproval }
}
