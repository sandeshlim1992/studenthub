// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub: the manager dashboard's data (GET /api/v1/ticket_approval/dashboard), the
// decision call, and the small formatters its cards share.

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

export interface ManagerTicketRef {
  ticket_id: number
  number: string
  title: string
}

export interface ManagerWaitingRequest extends ManagerTicketRef {
  reason: string
  requested_at: string
  requested_by: string | null
  team: string | null
  customer: string | null
  campus: string | null
  category: string | null
  sla_paused: boolean
  latest_message: { from: string | null; created_at: string; body: string } | null
}

export interface ManagerMonth {
  decided: number
  median_wait_seconds: number | null
  longest_wait_seconds: number | null
  over_warning: number
  previous: { decided: number; median_wait_seconds: number | null }
  per_week: { week_start: string; approved: number; denied: number }[]
  by_team: { name: string | null; decided: number; approved: number }[]
}

export interface ManagerDashboard {
  waiting: {
    count: number
    oldest_requested_at: string | null
    overdue: boolean
    requests: ManagerWaitingRequest[]
  }
  decisions: { approved: number; denied: number; approval_rate: number | null }
  month: ManagerMonth
  still_open: {
    count: number
    tickets: (ManagerTicketRef & { decided_at: string; owner: string | null; state: string })[]
  }
  recent: (ManagerTicketRef & {
    state: 'approved' | 'denied'
    comment: string | null
    decided_at: string
    requested_by: string | null
  })[]
  settings: {
    decisions_period_days: number
    waiting_warning_hours: number
    still_open_after_days: number
  }
}

/** Approve or deny through the approval API (TicketApprovalsController holds the rules). */
export const decideApproval = async (
  ticketId: number,
  decision: 'approve' | 'deny',
  comment: string,
) => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  const token = getCSRFToken()
  if (token) headers['X-CSRF-Token'] = token

  const response = await fetch(`/api/v1/tickets/${ticketId}/approval/${decision}`, {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({ comment }),
  })
  if (response.ok) return

  const data = await response.json().catch(() => ({}))
  throw new Error(data.error || data.error_human || `Request failed (${response.status})`)
}

const pad = (value: number) => String(value).padStart(2, '0')

/** Waiting time for the flap digits, "hh:mm" (capped at 99:59). */
export const waitClock = (from: string, now: Date) => {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(from).getTime()) / 60_000))
  const hours = Math.floor(minutes / 60)

  if (hours > 99) return '99:59'

  return `${pad(hours)}:${pad(minutes % 60)}`
}

export const isOverdue = (from: string, now: Date, warningHours: number) =>
  now.getTime() - new Date(from).getTime() > warningHours * 3_600_000

/** "38 m", "3 h 40", "2 d 4 h": a duration in the short form the cards use. */
export const formatWait = (seconds: number | null | undefined) => {
  if (seconds === null || seconds === undefined) return '–'

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} m`

  const hours = Math.floor(minutes / 60)
  if (hours < 48) return `${hours} h ${pad(minutes % 60)}`

  return `${Math.floor(hours / 24)} d ${hours % 24} h`
}
