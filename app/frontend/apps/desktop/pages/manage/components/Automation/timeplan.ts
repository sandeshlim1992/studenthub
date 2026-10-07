// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n/index.ts'

// Student Hub: when a scheduler job runs (Zammad's timeplan): the chosen days, hours and minutes
// (every 10 minutes), in the system's time zone.
//   { days: { Mon: true, … }, hours: { '9': true, … }, minutes: { '0': true, '30': true } }

export const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
export const MINUTES = [0, 10, 20, 30, 40, 50]

export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  Mon: __('Mon'),
  Tue: __('Tue'),
  Wed: __('Wed'),
  Thu: __('Thu'),
  Fri: __('Fri'),
  Sat: __('Sat'),
  Sun: __('Sun'),
}

export interface Timeplan {
  days: Record<string, boolean>
  hours: Record<string, boolean>
  minutes: Record<string, boolean>
}

export const emptyTimeplan = (): Timeplan => ({
  days: Object.fromEntries(DAYS.map((day) => [day, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day)])),
  hours: Object.fromEntries(HOURS.map((hour) => [String(hour), hour === 9])),
  minutes: Object.fromEntries(MINUTES.map((minute) => [String(minute), minute === 0])),
})

// Fills in every key, so the editor's checkboxes all have a value.
export const normalizeTimeplan = (timeplan?: Partial<Timeplan> | null): Timeplan => ({
  days: Object.fromEntries(DAYS.map((day) => [day, Boolean(timeplan?.days?.[day])])),
  hours: Object.fromEntries(HOURS.map((hour) => [String(hour), Boolean(timeplan?.hours?.[String(hour)])])),
  minutes: Object.fromEntries(MINUTES.map((minute) => [String(minute), Boolean(timeplan?.minutes?.[String(minute)])])),
})

const chosen = (values: Record<string, boolean>) =>
  Object.entries(values)
    .filter(([, on]) => on)
    .map(([key]) => key)

const pad = (value: number) => String(value).padStart(2, '0')

// Runs of neighbours: [1,2,3,5] → "1–3, 5"
const ranges = <T>(items: T[], index: (item: T) => number, label: (item: T) => string) => {
  const parts: string[] = []
  let start = 0
  items.forEach((item, position) => {
    const next = items[position + 1]
    if (next !== undefined && index(next) === index(item) + 1) return
    parts.push(start === position ? label(items[start]) : `${label(items[start])}–${label(item)}`)
    start = position + 1
  })
  return parts.join(', ')
}

export const timeplanProblems = (timeplan: Timeplan) => {
  const problems: string[] = []
  if (!chosen(timeplan.days).length) problems.push(__('Choose at least one day.'))
  if (!chosen(timeplan.hours).length) problems.push(__('Choose at least one hour.'))
  if (!chosen(timeplan.minutes).length) problems.push(__('Choose at least one minute.'))
  return problems
}

export const describeTimeplan = (input?: Partial<Timeplan> | null) => {
  const timeplan = normalizeTimeplan(input)
  const days = DAYS.filter((day) => timeplan.days[day])
  const hours = HOURS.filter((hour) => timeplan.hours[String(hour)])
  const minutes = MINUTES.filter((minute) => timeplan.minutes[String(minute)])

  if (!days.length || !hours.length || !minutes.length) return i18n.t('Never')

  const dayText =
    days.length === 7 ? i18n.t('Every day') : ranges(days, (day) => DAYS.indexOf(day), (day) => i18n.t(DAY_LABELS[day]))

  const minuteText =
    minutes.length === 6 ? i18n.t('every 10 minutes') : minutes.map((minute) => `:${pad(minute)}`).join(' ')

  const hourText =
    hours.length === 24
      ? i18n.t('all day')
      : ranges(
          hours,
          (hour) => hour,
          (hour) => `${pad(hour)}h`,
        )

  return `${dayText}, ${minuteText}, ${hourText}`
}
