// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { i18n } from '#shared/i18n.ts'

// Student Hub: the Reporting page's periods, figures and chart scale. Zammad's reporting API
// (/api/v1/reports/generate) gives one number per part of the period: the months of a year, the
// days of a month or week, the hours of a day or the minutes of the last hour.

export type ReportTimeRange = 'year' | 'month' | 'week' | 'day' | 'realtime'

export interface ReportPeriod {
  timeRange: ReportTimeRange
  year: number
  month: number
  week: number
  day: number
}

export interface ReportProfile {
  id: number
  name: string
}

export interface ReportBackend {
  name: string
  display: string
  selected?: boolean
  dataDownload?: boolean
}

export interface ReportMetric {
  name: string
  display: string
  prio?: number
  default?: boolean
  backend: ReportBackend[]
}

export interface ReportTile {
  label: string
  value: string
  note: string
  // A line in the colour of the chart's series, when the tile is one of them.
  color?: string
}

export interface ReportTicket {
  id: number
  number: string
  title: string
  campus: string
  stateId?: number
  createdAt: string
}

export interface ReportSets {
  count?: number
  ticket_ids?: number[]
  assets?: Record<string, Record<string, Record<string, unknown>>>
}

export const TIME_RANGES: ReportTimeRange[] = ['year', 'month', 'week', 'day', 'realtime']

export const TIME_RANGE_LABELS: Record<ReportTimeRange, string> = {
  year: __('Year'),
  month: __('Month'),
  week: __('Week'),
  day: __('Day'),
  realtime: __('Last hour'),
}

// Zammad's three metrics under names that say what they count.
const MEASURE_LABELS: Record<string, string> = {
  count: __('Ticket count'),
  create_channels: __('How tickets came in'),
  communication: __('Messages in and out'),
}

export const measureLabel = (metric: ReportMetric) => MEASURE_LABELS[metric.name] ?? metric.display

// Chart lines: the first in the application colour; the others told apart by dash as well as
// colour (all at least 3:1 against white).
export const SERIES_STYLES = [
  { color: 'var(--sh-app)', dash: '', width: 2.5 },
  { color: '#c2410c', dash: '6 4', width: 2 },
  { color: '#64748b', dash: '2 3', width: 2 },
  { color: '#0e7490', dash: '10 3 2 3', width: 2 },
  { color: '#7e22ce', dash: '12 4', width: 2 },
]

export const sum = (values: number[] = []) =>
  values.reduce((total, value) => total + (value || 0), 0)

export const formatNumber = (value: number) => value.toLocaleString(i18n.locale())

const isoWeekOf = (date: Date) => {
  const day = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(day.getUTCFullYear(), 0, 1))

  return {
    year: day.getUTCFullYear(),
    week: Math.ceil(((day.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  }
}

export const isoWeeksInYear = (year: number) => isoWeekOf(new Date(year, 11, 28)).week

// The period that holds now. A week belongs to the year of its Thursday (ISO), as Zammad counts it.
export const currentPeriod = (timeRange: ReportTimeRange, now = new Date()): ReportPeriod => {
  const { year: weekYear, week } = isoWeekOf(now)

  return {
    timeRange,
    year: timeRange === 'week' ? weekYear : now.getFullYear(),
    month: now.getMonth() + 1,
    week,
    day: now.getDate(),
  }
}

const fromDate = (period: ReportPeriod, date: Date): ReportPeriod => ({
  ...period,
  year: date.getFullYear(),
  month: date.getMonth() + 1,
  day: date.getDate(),
})

export const stepPeriod = (period: ReportPeriod, direction: 1 | -1): ReportPeriod => {
  switch (period.timeRange) {
    case 'year':
      return { ...period, year: period.year + direction }
    case 'month':
      return fromDate(period, new Date(period.year, period.month - 1 + direction, 1))
    case 'week': {
      const week = period.week + direction
      if (week < 1)
        return { ...period, year: period.year - 1, week: isoWeeksInYear(period.year - 1) }
      if (week > isoWeeksInYear(period.year)) return { ...period, year: period.year + 1, week: 1 }
      return { ...period, week }
    }
    case 'day':
      return fromDate(period, new Date(period.year, period.month - 1, period.day + direction))
    default:
      return period
  }
}

const weekStart = (year: number, week: number) => {
  const january4 = new Date(year, 0, 4)
  return new Date(year, 0, 4 - ((january4.getDay() || 7) - 1) + (week - 1) * 7)
}

const periodStart = (period: ReportPeriod) => {
  switch (period.timeRange) {
    case 'year':
      return new Date(period.year, 0, 1)
    case 'month':
      return new Date(period.year, period.month - 1, 1)
    case 'week':
      return weekStart(period.year, period.week)
    case 'day':
      return new Date(period.year, period.month - 1, period.day)
    default:
      return new Date()
  }
}

// Whether the next period has begun (the stepper goes no further than now).
export const canStepForward = (period: ReportPeriod, now = new Date()) =>
  period.timeRange !== 'realtime' && periodStart(stepPeriod(period, 1)) <= now

export const periodLabel = (period: ReportPeriod) => {
  const locale = i18n.locale()

  switch (period.timeRange) {
    case 'year':
      return String(period.year)
    case 'month':
      return new Date(period.year, period.month - 1, 1).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
      })
    case 'week':
      return i18n.t('Week %s, %s', period.week, period.year)
    case 'day':
      return new Date(period.year, period.month - 1, period.day).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    default:
      return i18n.t('Last hour')
  }
}

export const STEP_LABELS: Record<ReportTimeRange, [string, string]> = {
  year: [__('Previous year'), __('Next year')],
  month: [__('Previous month'), __('Next month')],
  week: [__('Previous week'), __('Next week')],
  day: [__('Previous day'), __('Next day')],
  realtime: ['', ''],
}

// The name of each part of the period, in the order of Zammad's numbers.
export const bucketLabels = (period: ReportPeriod, now = new Date()) => {
  const locale = i18n.locale()

  switch (period.timeRange) {
    case 'year':
      return Array.from({ length: 12 }, (_, month) =>
        new Date(period.year, month, 1).toLocaleDateString(locale, { month: 'short' }),
      )
    case 'month':
      return Array.from({ length: new Date(period.year, period.month, 0).getDate() }, (_, day) =>
        String(day + 1),
      )
    case 'week': {
      const start = weekStart(period.year, period.week)
      return Array.from({ length: 7 }, (_, day) =>
        new Date(start.getFullYear(), start.getMonth(), start.getDate() + day).toLocaleDateString(
          locale,
          {
            weekday: 'short',
          },
        ),
      )
    }
    case 'day':
      return Array.from({ length: 24 }, (_, hour) => `${hour}:00`)
    default:
      return Array.from({ length: 60 }, (_, minute) =>
        new Date(now.getTime() - (59 - minute) * 60000).toLocaleTimeString(locale, {
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
  }
}

const BUSIEST_LABELS: Record<ReportTimeRange, string> = {
  year: __('Busiest month'),
  month: __('Busiest day'),
  week: __('Busiest day'),
  day: __('Busiest hour'),
  realtime: __('Busiest minute'),
}

const busiest = (values: number[]) =>
  values.reduce((best, value, index) => (value > (values[best] ?? 0) ? index : best), 0)

// Ticket count: created, closed, what that leaves and when most came in.
export const countTiles = (
  data: Record<string, number[]>,
  period: ReportPeriod,
  labels: string[],
): ReportTile[] => {
  const created = data['count::created'] ?? []
  const createdTotal = sum(created)
  const closedTotal = sum(data['count::closed'])
  const backlog = createdTotal - closedTotal
  const busiestIndex = busiest(created)

  return [
    {
      label: i18n.t('Created'),
      value: formatNumber(createdTotal),
      note: i18n.t('tickets that came in'),
      color: SERIES_STYLES[0].color,
    },
    {
      label: i18n.t('Closed'),
      value: formatNumber(closedTotal),
      note: createdTotal
        ? i18n.t('%s% of those created', Math.round((closedTotal / createdTotal) * 100))
        : i18n.t('none created'),
      color: SERIES_STYLES[1].color,
    },
    {
      label: i18n.t('Backlog'),
      value: backlog > 0 ? `+${formatNumber(backlog)}` : formatNumber(backlog),
      note: i18n.t('created minus closed'),
    },
    {
      label: i18n.t(BUSIEST_LABELS[period.timeRange]),
      value: createdTotal ? (labels[busiestIndex] ?? '–') : '–',
      note: createdTotal
        ? i18n.t('%s created', formatNumber(created[busiestIndex] ?? 0))
        : i18n.t('nothing created'),
    },
  ]
}

// The other measures: the total and their three biggest series.
export const seriesTiles = (metric: ReportMetric, data: Record<string, number[]>): ReportTile[] => {
  const totals = metric.backend.map((backend, index) => ({
    display: backend.display,
    total: sum(data[backend.name]),
    color: SERIES_STYLES[index % SERIES_STYLES.length].color,
  }))
  const total = sum(totals.map((series) => series.total))
  const biggest = [...totals].sort((a, b) => b.total - a.total).slice(0, 3)

  return [
    {
      label: i18n.t('Total'),
      value: formatNumber(total),
      note:
        metric.name === 'communication'
          ? i18n.t('messages in and out')
          : i18n.t('tickets that came in'),
    },
    ...biggest.map((series) => ({
      label: i18n.t(series.display),
      value: formatNumber(series.total),
      note: total ? i18n.t('%s% of the total', Math.round((series.total / total) * 100)) : '',
      color: series.color,
    })),
  ]
}

export type BacklogTone = 'up' | 'down' | 'none'

// Created minus closed for each part of the period.
export const backlogChanges = (data: Record<string, number[]>) => {
  const created = data['count::created'] ?? []
  const closed = data['count::closed'] ?? []

  return created.map((value, index) => {
    const change = (value || 0) - (closed[index] || 0)
    let tone: BacklogTone = 'none'
    if (change > 0) tone = 'up'
    else if (change < 0) tone = 'down'

    return { label: change > 0 ? `+${change}` : String(change || '·'), tone }
  })
}

// The top of the chart's scale: four equal steps of a round number (whole numbers only).
export const niceMax = (value: number) => {
  if (value <= 4) return 4

  const rough = value / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const factors = magnitude >= 10 ? [1, 2, 2.5, 3, 4, 5, 6, 8, 10] : [1, 2, 3, 4, 5, 6, 8, 10]
  const step =
    factors.map((factor) => factor * magnitude).find((candidate) => candidate >= rough) ?? rough

  return step * 4
}

const text = (value: unknown) => (value == null ? '' : String(value))

// The tickets of a set, in Zammad's order (most recently updated first).
export const ticketsFromSets = (sets: ReportSets): ReportTicket[] => {
  const ticketAssets = sets.assets?.Ticket ?? {}

  return (sets.ticket_ids ?? []).map((id) => {
    const ticket = ticketAssets[id] ?? {}

    return {
      id,
      number: text(ticket.number) || String(id),
      title: text(ticket.title),
      campus: text(ticket.campus),
      stateId: typeof ticket.state_id === 'number' ? ticket.state_id : undefined,
      createdAt: text(ticket.created_at),
    }
  })
}

export const ticketDate = (iso: string, now = new Date()) => {
  if (!iso) return '–'

  const date = new Date(iso)
  return date.toLocaleDateString(i18n.locale(), {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  })
}

export const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, index * size + size),
  )
