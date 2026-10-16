// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, onMounted, onUnmounted, ref } from 'vue'

import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import {
  canStepForward,
  chunk,
  currentPeriod,
  stepPeriod,
  sum,
  ticketsFromSets,
  TIME_RANGES,
  type ReportMetric,
  type ReportPeriod,
  type ReportProfile,
  type ReportSets,
  type ReportTicket,
  type ReportTimeRange,
} from '../utils/studenthubReport.ts'

// Student Hub: the Reporting page's data, all from Zammad's reporting API (needs Elasticsearch
// and at least one report profile): the profiles and measures (config), the chart's numbers
// (generate) and the tickets behind a series (sets, at most 100 there; the spreadsheet has all).
// Every call goes through studenthubApi (with the CSRF token Zammad requires). A newer request
// wins over an older one still on its way.

interface ReportConfig {
  error?: string
  profiles?: ReportProfile[]
  config?: { metric?: Record<string, ReportMetric> }
}

const STORAGE_KEY = 'report::params'
const ROWS_STEP = 10
const PROFILE_COUNT_BATCH = 4

// Live: how often the figures refresh for each kind of period.
const LIVE_INTERVALS: Record<ReportTimeRange, number> = {
  year: 300000,
  month: 60000,
  week: 50000,
  day: 30000,
  realtime: 10000,
}

const periodParams = (period: ReportPeriod) => ({
  timeRange: period.timeRange,
  year: period.year,
  month: period.month,
  week: period.week,
  day: period.day,
})

export const useStudenthubReport = () => {
  const isConfigLoading = ref(true)
  const isFiguresLoading = ref(false)
  const isTicketsLoading = ref(false)
  // Zammad's reason when it can't report at all (no Elasticsearch, no report profiles).
  const configError = ref('')
  // Zammad couldn't make the figures or the ticket list.
  const dataError = ref('')

  const profiles = ref<ReportProfile[]>([])
  const metrics = ref<Record<string, ReportMetric>>({})
  const profileId = ref<number | null>(null)
  const metricKey = ref('count')
  const period = ref<ReportPeriod>(currentPeriod('year'))
  const isLive = ref(true)
  const updatedAt = ref<Date | null>(null)

  const figures = ref<Record<string, number[]>>({})
  // Tickets created in the period, for each profile (next to its name).
  const profileCounts = ref<Record<number, number>>({})

  const ticketsBackend = ref('')
  const tickets = ref<ReportTicket[]>([])
  const ticketsCount = ref(0)
  const visibleRows = ref(ROWS_STEP)
  // State names for the ticket list (the report gives ids). Agents and admins may read them.
  const stateNames = ref<Record<number, string>>({})

  const profile = computed(() => profiles.value.find((item) => item.id === profileId.value) ?? null)

  const measures = computed(() =>
    Object.values(metrics.value).sort((a, b) => (a.prio ?? 0) - (b.prio ?? 0)),
  )

  const metric = computed(() => metrics.value[metricKey.value] ?? null)

  const ticketBackends = computed(
    () => metric.value?.backend.filter((backend) => backend.dataDownload) ?? [],
  )

  const totals = computed(() =>
    Object.fromEntries(Object.entries(figures.value).map(([name, values]) => [name, sum(values)])),
  )

  const canGoForward = computed(() => canStepForward(period.value))

  const save = () => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...periodParams(period.value),
          metric: metricKey.value,
          profileSelected: profileId.value ? { [profileId.value]: true } : {},
          downloadBackendSelected: ticketsBackend.value,
          live: isLive.value,
        }),
      )
    } catch {
      // nothing remembered
    }
  }

  const restore = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')
      if (!saved) return

      if (TIME_RANGES.includes(saved.timeRange)) {
        period.value = {
          timeRange: saved.timeRange,
          year: Number(saved.year) || period.value.year,
          month: Number(saved.month) || period.value.month,
          week: Number(saved.week) || period.value.week,
          day: Number(saved.day) || period.value.day,
        }
      }
      if (typeof saved.metric === 'string') metricKey.value = saved.metric
      if (typeof saved.downloadBackendSelected === 'string') {
        ticketsBackend.value = saved.downloadBackendSelected
      }
      if (typeof saved.live === 'boolean') isLive.value = saved.live

      const savedProfile = Number(Object.keys(saved.profileSelected ?? {})[0])
      if (savedProfile) profileId.value = savedProfile
    } catch {
      // start afresh
    }
  }

  // The list under the figures: the series chosen before when this measure has it, else its first.
  const pickTicketsBackend = () => {
    if (ticketBackends.value.some((backend) => backend.name === ticketsBackend.value)) return

    ticketsBackend.value = ticketBackends.value[0]?.name ?? ''
  }

  let figuresRequest = 0

  const loadFigures = async () => {
    const current = metric.value
    if (!profileId.value || !current) return

    figuresRequest += 1
    const request = figuresRequest
    isFiguresLoading.value = true

    try {
      const json = await studenthubApi<{ data?: Record<string, number[]> }>(
        '/api/v1/reports/generate',
        {
          method: 'POST',
          body: {
            metric: current.name,
            ...periodParams(period.value),
            profiles: { [profileId.value]: true },
            // Every series: the tiles and the ticket list's tabs show their totals.
            backends: Object.fromEntries(current.backend.map((backend) => [backend.name, true])),
          },
        },
      )
      if (request !== figuresRequest) return

      figures.value = json.data ?? {}
      dataError.value = ''
      updatedAt.value = new Date()
    } catch (error) {
      if (request !== figuresRequest) return

      figures.value = {}
      dataError.value = (error as Error).message
    } finally {
      if (request === figuresRequest) isFiguresLoading.value = false
    }
  }

  let ticketsRequest = 0

  const loadTickets = async () => {
    ticketsRequest += 1
    const request = ticketsRequest

    if (!profileId.value || !ticketsBackend.value) {
      tickets.value = []
      ticketsCount.value = 0
      return
    }

    isTicketsLoading.value = true

    try {
      const json = await studenthubApi<ReportSets>('/api/v1/reports/sets', {
        method: 'POST',
        body: {
          metric: metricKey.value,
          ...periodParams(period.value),
          profiles: { [profileId.value]: true },
          downloadBackendSelected: ticketsBackend.value,
        },
      })
      if (request !== ticketsRequest) return

      ticketsCount.value = json.count ?? 0
      tickets.value = ticketsFromSets(json)
    } catch (error) {
      if (request !== ticketsRequest) return

      tickets.value = []
      ticketsCount.value = 0
      dataError.value = (error as Error).message
    } finally {
      if (request === ticketsRequest) isTicketsLoading.value = false
    }
  }

  let countsRequest = 0

  // A few at a time, so a long list of profiles doesn't flood Elasticsearch.
  const loadProfileCounts = () => {
    countsRequest += 1
    const request = countsRequest

    if (!metrics.value.count) {
      profileCounts.value = {}
      return Promise.resolve()
    }

    const counts: Record<number, number> = {}
    const countOne = (item: ReportProfile) =>
      studenthubApi<{ data?: Record<string, number[]> }>('/api/v1/reports/generate', {
        method: 'POST',
        body: {
          metric: 'count',
          ...periodParams(period.value),
          profiles: { [item.id]: true },
          backends: { 'count::created': true },
        },
      })
        .then((json) => {
          counts[item.id] = sum(json.data?.['count::created'])
        })
        .catch(() => {
          // no count for this profile
        })

    return chunk(profiles.value, PROFILE_COUNT_BATCH)
      .reduce<Promise<unknown>>(
        (previous, batch) => previous.then(() => Promise.all(batch.map(countOne))),
        Promise.resolve(),
      )
      .then(() => {
        if (request === countsRequest) profileCounts.value = counts
      })
  }

  let liveTimer: ReturnType<typeof setTimeout> | null = null

  const stopLive = () => {
    if (liveTimer) clearTimeout(liveTimer)
    liveTimer = null
  }

  const refresh = async () => {
    stopLive()
    await Promise.all([loadFigures(), loadTickets()])
    save()

    if (isLive.value) liveTimer = setTimeout(refresh, LIVE_INTERVALS[period.value.timeRange])
  }

  const loadConfig = async () => {
    isConfigLoading.value = true
    configError.value = ''

    try {
      const data = await studenthubApi<ReportConfig>('/api/v1/reports/config')

      if (data.error) {
        configError.value = data.error
        return
      }

      profiles.value = data.profiles ?? []
      metrics.value = data.config?.metric ?? {}

      if (!profiles.value.some((item) => item.id === profileId.value)) {
        profileId.value = profiles.value[0]?.id ?? null
      }
      if (!metrics.value[metricKey.value]) {
        metricKey.value =
          measures.value.find((item) => item.default)?.name ?? measures.value[0]?.name ?? 'count'
      }
      pickTicketsBackend()

      await Promise.all([refresh(), loadProfileCounts()])
    } catch (error) {
      configError.value = (error as Error).message
    } finally {
      isConfigLoading.value = false
    }
  }

  const loadStateNames = async () => {
    try {
      const states = await studenthubApi<{ id: number; name: string }[]>('/api/v1/ticket_states')
      stateNames.value = Object.fromEntries(states.map((state) => [state.id, state.name]))
    } catch {
      // no state names
    }
  }

  const selectProfile = (id: number) => {
    if (id === profileId.value) return

    profileId.value = id
    visibleRows.value = ROWS_STEP
    refresh()
  }

  const selectMetric = (key: string) => {
    if (key === metricKey.value || !metrics.value[key]) return

    metricKey.value = key
    pickTicketsBackend()
    visibleRows.value = ROWS_STEP
    figures.value = {}
    refresh()
  }

  // Another kind of period starts at the one that holds now.
  const selectTimeRange = (timeRange: ReportTimeRange) => {
    if (timeRange === period.value.timeRange) return

    period.value = currentPeriod(timeRange)
    visibleRows.value = ROWS_STEP
    refresh()
    loadProfileCounts()
  }

  const step = (direction: 1 | -1) => {
    if (direction === 1 && !canGoForward.value) return

    period.value = stepPeriod(period.value, direction)
    visibleRows.value = ROWS_STEP
    refresh()
    loadProfileCounts()
  }

  const selectTicketsBackend = (name: string) => {
    if (name === ticketsBackend.value) return

    ticketsBackend.value = name
    visibleRows.value = ROWS_STEP
    loadTickets()
    save()
  }

  const showMoreTickets = () => {
    visibleRows.value += ROWS_STEP
  }

  const setLive = (live: boolean) => {
    isLive.value = live
    if (live) refresh()
    else {
      stopLive()
      save()
    }
  }

  // Zammad's spreadsheet of the series in the ticket list, with all its tickets.
  const downloadExcel = () => {
    if (!profileId.value || !ticketsBackend.value) return

    const query = new URLSearchParams({
      sheet: 'true',
      metric: metricKey.value,
      year: String(period.value.year),
      month: String(period.value.month),
      week: String(period.value.week),
      day: String(period.value.day),
      timeRange: period.value.timeRange,
      profile_id: String(profileId.value),
      downloadBackendSelected: ticketsBackend.value,
    })

    window.open(`/api/v1/reports/sets?${query.toString()}`, '_blank')
  }

  onMounted(() => {
    restore()
    loadStateNames()
    loadConfig()
  })

  onUnmounted(stopLive)

  return {
    isConfigLoading,
    isFiguresLoading,
    isTicketsLoading,
    configError,
    dataError,
    profiles,
    profile,
    profileId,
    profileCounts,
    measures,
    metric,
    metricKey,
    period,
    canGoForward,
    isLive,
    updatedAt,
    figures,
    totals,
    ticketBackends,
    ticketsBackend,
    tickets,
    ticketsCount,
    visibleRows,
    stateNames,
    selectProfile,
    selectMetric,
    selectTimeRange,
    step,
    selectTicketsBackend,
    showMoreTickets,
    setLive,
    downloadExcel,
  }
}
