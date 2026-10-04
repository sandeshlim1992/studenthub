// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

export type FeedbackState = 'pending' | 'sent' | 'failed' | 'submitted'

export interface FeedbackItem {
  id: number
  ticket_id: number | null
  ticket_number: string
  ticket_title: string
  customer_name: string
  customer_email: string
  owner_name: string
  group_name: string
  state: FeedbackState
  source: 'native' | 'import'
  sent_at: string | null
  error: string | null
  rating: number | null
  comments: string | null
  rated_at: string | null
  created_at: string
}

export interface FeedbackListResponse {
  items: FeedbackItem[]
  total: number
  page: number
  per_page: number
}

export interface ReportRow {
  name: string
  count: number
  average: number
}

export interface FeedbackReport {
  from: string | null
  to: string | null
  requests: number
  responses: number
  average: number | null
  distribution: Record<string, number>
  by_agent: ReportRow[]
  by_group: ReportRow[]
  by_month: { month: string; count: number; average: number }[]
}

export interface FeedbackConfig {
  channel_id: number | null
  from_name: string
  from_email: string
  reply_to: string
  notify_email: string
  group_ids: number[]
  require_owner: boolean
  skip_tags: string[]
  resend_after_days: number
  add_internal_note: boolean
}

export interface FeedbackChannel {
  id: number
  area: string
  active: boolean
  adapter: string | null
  label: string
}

export interface FeedbackSettings {
  enabled: boolean
  config: FeedbackConfig
  subject: string
  template: string
  template_custom: boolean
  default_template: string
  placeholders: string[]
  channels: FeedbackChannel[]
  groups: { id: number; name: string; active: boolean }[]
  feedback_url: string
}

export interface FeedbackSettingsUpdate {
  enabled?: boolean
  config?: Partial<FeedbackConfig>
  subject?: string
  template?: string
}
