// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n.ts'

// Student Hub: shared pieces of the agents' "Briefing" and the admins' "Team overview" dashboards.

export type StudenthubDashboardTone = 'good' | 'warn' | 'bad' | 'neutral'

export type StudenthubChannelKey = 'email' | 'phone' | 'web' | 'other'

// The dashboards a user can switch between: the admins' team overview, the agents' own figures
// and the managers' approvals.
export type StudenthubDashboardViewKey = 'team' | 'mine' | 'approvals'

export interface StudenthubDashboardView {
  value: StudenthubDashboardViewKey
  label: string
}

export const STUDENTHUB_DASHBOARD_CHANNELS: Record<
  StudenthubChannelKey,
  { label: string; color: string }
> = {
  email: { label: __('Email'), color: 'var(--sh-app)' },
  phone: { label: __('Phone'), color: '#0e7c7b' },
  web: { label: __('Web / Portal'), color: '#b97a00' },
  other: { label: __('Other'), color: '#8b95a8' },
}

// Zammad's mood scale for the escalation figure.
export const STUDENTHUB_MOODS: Record<string, { label: string; tone: StudenthubDashboardTone }> = {
  supergood: { label: __('Supergood'), tone: 'good' },
  good: { label: __('Good'), tone: 'good' },
  ok: { label: __('Ok'), tone: 'warn' },
  bad: { label: __('Bad'), tone: 'bad' },
  superbad: { label: __('Superbad'), tone: 'bad' },
}

export const studenthubMood = (state?: string | null) =>
  STUDENTHUB_MOODS[(state ?? '').toLowerCase()] ?? null

export const formatMinutes = (minutes: number) => {
  const rounded = Math.round(minutes)
  if (rounded < 60) return i18n.t('%s min', rounded)

  const rest = rounded % 60
  return rest
    ? i18n.t('%s h %s min', Math.floor(rounded / 60), rest)
    : i18n.t('%s h', Math.floor(rounded / 60))
}

// With %s for the first name.
export const greeting = (date: Date) => {
  const hour = date.getHours()
  if (hour < 12) return __('Good morning, %s')
  if (hour < 18) return __('Good afternoon, %s')
  return __('Good evening, %s')
}

export const initials = (name?: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'

  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

// Each text colour keeps 4.5:1 with white.
const AVATAR_COLORS = ['#2b5aa8', '#0e6b6b', '#6a3fb0', '#a8331f', '#4a5262', '#7a5500']

export const avatarColor = (id?: number | null) =>
  AVATAR_COLORS[Math.abs(id ?? 0) % AVATAR_COLORS.length]

// A share for bars, 0–100, with a floor so a small non-zero value stays visible.
export const share = (value: number, max: number) => {
  if (!max || value <= 0) return 0
  return Math.max(2, Math.min(100, (value / max) * 100))
}
