// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

import type {
  FeedbackListResponse,
  FeedbackReport,
  FeedbackSettings,
  FeedbackSettingsUpdate,
} from './types.ts'

const BASE = '/api/v1/feedback_collection'

const request = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }
  if (init.body) headers['Content-Type'] = 'application/json'

  const method = (init.method || 'GET').toUpperCase()
  if (method !== 'GET') {
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token
  }

  const response = await fetch(`${BASE}${path}`, {
    credentials: 'same-origin',
    ...init,
    headers,
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.error_human || `Request failed (${response.status})`)
  }
  return data as T
}

const query = (params: Record<string, string | number | undefined | null>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export interface ListParams {
  page: number
  per_page: number
  sort_by: string
  order_by: 'asc' | 'desc'
  state: string
  rating?: number | ''
  from?: string
  to?: string
  query?: string
}

export const feedbackApi = {
  list: (params: ListParams) =>
    request<FeedbackListResponse>(`/requests${query({ ...params })}`),

  remove: (id: number) => request<object>(`/requests/${id}`, { method: 'DELETE' }),

  exportUrl: (params: Partial<ListParams>) =>
    `${BASE}/export${query({ state: 'submitted', rating: params.rating, from: params.from, to: params.to, query: params.query })}`,

  report: (from?: string, to?: string) => request<FeedbackReport>(`/report${query({ from, to })}`),

  settings: () => request<FeedbackSettings>('/settings'),

  saveSettings: (payload: FeedbackSettingsUpdate) =>
    request<FeedbackSettings>('/settings', { method: 'PUT', body: JSON.stringify(payload) }),

  preview: (subject: string, template: string) =>
    request<{ subject: string; body: string }>('/preview', {
      method: 'POST',
      body: JSON.stringify({ subject, template }),
    }),

  testEmail: (to?: string) =>
    request<{ sent_to: string }>('/test_email', {
      method: 'POST',
      body: JSON.stringify({ to }),
    }),
}
