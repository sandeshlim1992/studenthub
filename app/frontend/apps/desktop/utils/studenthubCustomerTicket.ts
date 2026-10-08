// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { StudenthubStateTone } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: the student's column on the ticket screen
// (GET /api/v1/studenthub/customer_tickets/:id, Service::StudenthubCustomerTicket::Overview).

export type StudenthubCustomerTicketStage =
  | 'received'
  | 'with_team'
  | 'in_progress'
  | 'waiting_for_you'
  | 'on_hold'
  | 'review'
  | 'resolved'
  | 'closed'

export interface StudenthubCustomerTicketFile {
  id: number
  article_id: number
  filename: string
  size: number
  content_type: string | null
  from_team: boolean
  created_at: string
  url: string
}

export type StudenthubCustomerTicketFeedback =
  | { state: 'awaiting' }
  | { state: 'submitted'; rating: number; comments: string | null; rated_at: string }

export interface StudenthubCustomerTicketOverview {
  id: number
  number: string
  title: string
  team: string | null
  created_at: string
  last_team_reply_at: string | null
  fields: { name: string; label: string; value: string }[]
  progress: { stage: StudenthubCustomerTicketStage; step: number }
  files: StudenthubCustomerTicketFile[]
  actions: { can_close: boolean; can_reopen: boolean; new_ticket: boolean }
  feedback: StudenthubCustomerTicketFeedback | null
}

export const STUDENTHUB_CUSTOMER_TICKET_STEPS = [
  __('Received'),
  __('With the team'),
  __('Being worked on'),
  __('Resolved'),
]

// What each stage means for the student, in their words.
export const STUDENTHUB_CUSTOMER_TICKET_STATUS: Record<
  StudenthubCustomerTicketStage,
  { label: string; note: string; tone: StudenthubStateTone }
> = {
  received: {
    label: __('Received'),
    note: __('We have your request and will pass it to the right team.'),
    tone: 'blue',
  },
  with_team: {
    label: __('With the team'),
    note: __('The team has your request and will start on it soon.'),
    tone: 'blue',
  },
  in_progress: {
    label: __('Being worked on'),
    note: __('Someone is working on your request.'),
    tone: 'teal',
  },
  waiting_for_you: {
    label: __('Waiting for you'),
    note: __('We have asked you something. Reply below to continue.'),
    tone: 'amber',
  },
  on_hold: {
    label: __('On hold'),
    note: __('Your request is on hold for now. We will pick it up again.'),
    tone: 'grey',
  },
  review: {
    label: __('Being reviewed'),
    note: __('Your request is being reviewed before we continue.'),
    tone: 'purple',
  },
  resolved: {
    label: __('Resolved'),
    note: __('We think this is fixed. If it is not, you can reopen it.'),
    tone: 'green',
  },
  closed: {
    label: __('Closed'),
    note: __('This request is closed.'),
    tone: 'grey',
  },
}

export const studenthubCustomerTicketPath = (ticketId: number | string, action?: string) =>
  `/api/v1/studenthub/customer_tickets/${ticketId}${action ? `/${action}` : ''}`
