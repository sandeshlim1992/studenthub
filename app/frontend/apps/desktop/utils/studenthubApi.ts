// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { getCSRFToken } from '#shared/server/apollo/utils/csrfToken.ts'

// Student Hub: calls to Zammad's REST API from the new UI. Sends the session's CSRF token with
// changes (Zammad refuses changes without it) and turns error replies into StudenthubApiError,
// with Zammad's message for people when it gives one.

export class StudenthubApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'StudenthubApiError'
    this.status = status
  }
}

export interface StudenthubApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  formData?: FormData
}

const parse = (text: string) => {
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export const studenthubApi = async <T = unknown>(
  path: string,
  { method = 'GET', body, formData }: StudenthubApiOptions = {},
): Promise<T> => {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  if (method !== 'GET') {
    const token = getCSRFToken()
    if (token) headers['X-CSRF-Token'] = token
  }

  let payload: BodyInit | undefined
  if (formData) {
    payload = formData
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const response = await fetch(path, { method, credentials: 'same-origin', headers, body: payload })
  const data = parse(await response.text())

  if (!response.ok) {
    const message = data?.error_human || data?.error || `${response.status} ${response.statusText}`.trim()
    throw new StudenthubApiError(message, response.status)
  }

  return data as T
}
