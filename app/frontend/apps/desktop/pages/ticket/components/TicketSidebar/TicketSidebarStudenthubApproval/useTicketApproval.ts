// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub Ticket Approvals: talks to the approval REST API (TicketApprovalsController),
// which holds all the rules, so the classic and the new UI behave the same.

import { ref, type Ref } from 'vue'

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

export type ApprovalState = 'pending' | 'approved' | 'denied'

export interface ApprovalUser {
  id: number
  name: string
}

export interface ApprovalRound {
  id: number
  state: ApprovalState | 'cancelled'
  reason: string
  comment: string | null
  requested_by: ApprovalUser | null
  approver: ApprovalUser | null
  decided_by: ApprovalUser | null
  requested_at: string
  decided_at: string | null
}

export type ApprovalManager = ApprovalUser

export interface ApprovalStatus {
  enabled: boolean
  state: ApprovalState | null
  current: ApprovalRound | null
  history: ApprovalRound[]
  can_request: boolean
  can_cancel: boolean
  can_decide: boolean
  managers: ApprovalManager[]
}

export const useTicketApproval = (ticketId: Ref<number | undefined>) => {
  const status = ref<ApprovalStatus | null>(null)
  const isLoading = ref(false)
  const isBusy = ref(false)
  const errorMessage = ref('')

  const call = async (method: string, path = '', body?: object) => {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
    }
    if (method !== 'GET') {
      headers['Content-Type'] = 'application/json'
      const token = getCSRFToken()
      if (token) headers['X-CSRF-Token'] = token
    }

    const response = await fetch(`/api/v1/tickets/${ticketId.value}/approval${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      body: body ? JSON.stringify(body) : undefined,
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.error || data.error_human || `Request failed (${response.status})`)
    }
    return data as ApprovalStatus
  }

  const load = async () => {
    if (!ticketId.value) return
    isLoading.value = true
    try {
      status.value = await call('GET')
      errorMessage.value = ''
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      isLoading.value = false
    }
  }

  const run = async (method: string, path: string, body?: object) => {
    isBusy.value = true
    try {
      status.value = await call(method, path, body)
      errorMessage.value = ''
      return true
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
      return false
    } finally {
      isBusy.value = false
    }
  }

  return {
    status,
    isLoading,
    isBusy,
    errorMessage,
    load,
    sendForApproval: (approverId: number, reason: string) =>
      run('POST', '', { approver_id: approverId, reason }),
    approve: (comment: string) => run('POST', '/approve', { comment }),
    deny: (comment: string) => run('POST', '/deny', { comment }),
    withdraw: () => run('DELETE', ''),
  }
}

export type TicketApproval = ReturnType<typeof useTicketApproval>
