// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n.ts'

// Student Hub: helpers for the ticket screen (Details list, SLA card, message labels).

export const STUDENTHUB_ARTICLE_TYPE_LABELS: Record<string, string> = {
  email: __('Email'),
  phone: __('Phone'),
  web: __('Web form'),
  note: __('Note'),
  sms: __('SMS'),
  chat: __('Chat'),
  fax: __('Fax'),
  'whatsapp message': __('WhatsApp'),
  'telegram personal-message': __('Telegram'),
  'facebook feed post': __('Facebook'),
  'facebook feed comment': __('Facebook'),
}

/** Untranslated label of an article type ("email" → "Email"); unknown types as they are. */
export const articleTypeLabel = (type?: string | null) =>
  type ? (STUDENTHUB_ARTICLE_TYPE_LABELS[type] ?? type) : ''

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

/** "Today 09:14", "Tomorrow 17:00", "Yesterday 08:30", otherwise the full date and time. */
export const formatDayTime = (value: string | null | undefined, now: Date) => {
  if (!value) return ''

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const time = new Intl.DateTimeFormat(i18n.locale(), {
    hour: '2-digit',
    minute: '2-digit',
    hour12: i18n.getTimeFormatType() === '12hour',
  }).format(date)

  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000)
  if (days === 0) return i18n.t('Today %s', time)
  if (days === 1) return i18n.t('Tomorrow %s', time)
  if (days === -1) return i18n.t('Yesterday %s', time)

  return i18n.dateTime(value)
}

/**
 * Share of the time between opening and the deadline that has passed (0–1). Wall-clock time,
 * so it is only a guide: Zammad counts SLA time in the calendar's business hours.
 */
export const slaElapsedShare = (
  start: string | null | undefined,
  deadline: string | null | undefined,
  now: number,
) => {
  const from = start ? Date.parse(start) : NaN
  const to = deadline ? Date.parse(deadline) : NaN
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  if (to <= from) return 1

  return Math.min(1, Math.max(0, (now - from) / (to - from)))
}

/** SLA result Zammad stores once a target is reached: minutes left at that moment (negative = late). */
export const slaResult = (diffInMinutes: unknown) => {
  if (typeof diffInMinutes !== 'number') return null
  return diffInMinutes >= 0 ? 'met' : 'missed'
}
