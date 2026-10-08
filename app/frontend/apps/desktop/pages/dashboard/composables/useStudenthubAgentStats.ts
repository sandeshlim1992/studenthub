// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, ref } from 'vue'

// Student Hub: an agent's own figures for the "Briefing" dashboard. Zammad works them out in
// the background for the classic dashboard (its StatsStore) and hands them out with
// /api/v1/signshow. Averages can be "-" while there is nothing to compare with.

interface Average {
  average_per_agent?: number | string
}

export interface StudenthubAgentStatsData {
  StatsTicketWaitingTime?: Average & { handling_time?: number; state?: string }
  StatsTicketEscalation?: Average & { own?: number; total?: number; state?: string }
  StatsTicketChannelDistribution?: {
    channels?: Record<string, { inbound?: number; outbound?: number }>
  }
  StatsTicketLoadMeasure?: Average & { own?: number; total?: number; state?: string }
  StatsTicketInProcess?: Average & { in_process?: number; percent?: number; total?: number }
  StatsTicketReopen?: Average & { count?: number; percent?: number; total?: number }
}

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export const useStudenthubAgentStats = () => {
  const data = ref<StudenthubAgentStatsData>({})
  const isLoading = ref(false)
  const hasLoaded = ref(false)

  const load = async () => {
    isLoading.value = true
    try {
      const response = await fetch('/api/v1/signshow', {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      })
      if (response.ok) {
        const body = await response.json()
        data.value = body.collections?.StatsStore?.[0]?.data ?? {}
      }
    } catch {
      // Keep the figures already shown; Refresh tries again.
    } finally {
      isLoading.value = false
      hasLoaded.value = true
    }
  }

  const waiting = computed(() => {
    const stats = data.value.StatsTicketWaitingTime
    return {
      me: stats?.handling_time ?? 0,
      team: toNumber(stats?.average_per_agent),
    }
  })

  const escalation = computed(() => {
    const stats = data.value.StatsTicketEscalation
    return { own: stats?.own ?? 0, total: stats?.total ?? 0, state: stats?.state ?? null }
  })

  const assigned = computed(() => {
    const stats = data.value.StatsTicketLoadMeasure
    return { own: stats?.own ?? 0, total: stats?.total ?? 0, average: toNumber(stats?.average_per_agent) }
  })

  const inProcess = computed(() => {
    const stats = data.value.StatsTicketInProcess
    return {
      percent: stats?.percent ?? 0,
      count: stats?.in_process ?? 0,
      total: stats?.total ?? 0,
      average: toNumber(stats?.average_per_agent),
    }
  })

  const reopen = computed(() => {
    const stats = data.value.StatsTicketReopen
    return {
      percent: stats?.percent ?? 0,
      count: stats?.count ?? 0,
      total: stats?.total ?? 0,
      average: toNumber(stats?.average_per_agent),
    }
  })

  const channels = computed(() => {
    const raw = data.value.StatsTicketChannelDistribution?.channels ?? {}
    const list = (['email', 'phone', 'web'] as const).map((key) => ({
      key,
      count: (raw[key]?.inbound ?? 0) + (raw[key]?.outbound ?? 0),
    }))

    return { list, total: list.reduce((sum, channel) => sum + channel.count, 0) }
  })

  return { isLoading, hasLoaded, load, waiting, escalation, assigned, inProcess, reopen, channels }
}
