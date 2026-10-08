<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { i18n } from '#shared/i18n.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { studenthubApi } from '#desktop/utils/studenthubApi.ts'

import { useStudenthubDashboardActivity } from '../composables/useStudenthubDashboardActivity.ts'
import {
  STUDENTHUB_DASHBOARD_CHANNELS,
  type StudenthubChannelKey,
  share,
} from '../utils/studenthubDashboard.ts'

import StudenthubDashboardActivity from './StudenthubDashboardActivity.vue'

import '../styles/studenthub-dashboard.css'

// Student Hub: the admins' dashboard ("Team overview", Bento): open tickets by team, SLA
// deadlines, tickets without an agent, who is online, new and closed tickets of the last days,
// open tickets by site, how tickets came in, approvals waiting and the students' rating
// (GET /api/v1/studenthub/dashboard/overview), with the latest activity in a rail.

interface TeamCount {
  id: number
  name: string
  count: number
  waiting_for_approval: boolean
  view_link: string | null
}

interface SiteCount {
  id: number
  name: string
  count: number
  view_link: string | null
}

interface StudenthubAdminOverview {
  open: { total: number; created_today: number; closed_today: number; teams: TeamCount[] }
  sla: { overdue: number; due_soon: number; on_track: number; none: number }
  unassigned: { count: number; oldest_created_at: string | null }
  trend: { date: string; created: number; closed: number }[]
  sites: { list: SiteCount[]; without_site: number }
  channels: { key: StudenthubChannelKey; count: number }[]
  agents: { online: number; total: number }
  approvals: { waiting: number; oldest_requested_at: string | null } | null
  rating: { count: number; average: number | null } | null
  settings: {
    trend_days: number
    channel_days: number
    rating_days: number
    escalation_warning_minutes: number
  }
}

const data = ref<StudenthubAdminOverview | null>(null)
const isLoading = ref(false)
const loadFailed = ref(false)

const loadOverview = async () => {
  isLoading.value = true
  try {
    data.value = await studenthubApi<StudenthubAdminOverview>('/api/v1/studenthub/dashboard/overview')
    loadFailed.value = false
  } catch {
    loadFailed.value = true
  } finally {
    isLoading.value = false
  }
}

const {
  items: activityItems,
  isLoading: isActivityLoading,
  loadFailed: activityFailed,
  load: loadActivity,
} = useStudenthubDashboardActivity()

const refresh = () => Promise.all([loadOverview(), loadActivity()])

onMounted(refresh)

const summary = computed(() => {
  if (!data.value) return ''

  return i18n.t(
    '%s open tickets across the teams: %s past their SLA deadline, %s without an agent.',
    data.value.open.total,
    data.value.sla.overdue,
    data.value.unassigned.count,
  )
})

// Open tickets: the biggest teams, the rest as one line.
const TEAM_LIMIT = 6
const teams = computed(() => data.value?.open.teams.slice(0, TEAM_LIMIT) ?? [])
const otherTeamsCount = computed(() =>
  (data.value?.open.teams.slice(TEAM_LIMIT) ?? []).reduce((sum, team) => sum + team.count, 0),
)
const teamMax = computed(() => Math.max(1, ...teams.value.map((team) => team.count)))
const teamLabel = (team: TeamCount) => (team.waiting_for_approval ? i18n.t('Waiting for approval') : team.name)

const slaParts = computed(() => {
  const sla = data.value?.sla
  if (!sla) return []

  return [
    { key: 'overdue', label: __('Overdue'), count: sla.overdue, color: '#b4232f' },
    { key: 'due_soon', label: __('Due soon'), count: sla.due_soon, color: '#c98500' },
    { key: 'on_track', label: __('On track'), count: sla.on_track, color: '#16794a' },
    { key: 'none', label: __('No deadline'), count: sla.none, color: 'var(--dash-team)' },
  ]
})
const slaTotal = computed(() => slaParts.value.reduce((sum, part) => sum + part.count, 0))

// Ring: the share of members online.
const RING_SIZE = 76
const RING_STROKE = 9
const ringRadius = (RING_SIZE - RING_STROKE) / 2
const ringLength = 2 * Math.PI * ringRadius
const onlineDash = computed(() => {
  const agents = data.value?.agents
  const part = agents?.total ? (agents.online / agents.total) * ringLength : 0
  return `${part} ${ringLength}`
})

// New and closed tickets per day, as pairs of bars on one scale.
const CHART_WIDTH = 360
const CHART_HEIGHT = 140
const CHART_TOP = 16
const CHART_BOTTOM = 20
const chartPlot = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM

const trendDays = computed(() => {
  const days = data.value?.trend ?? []
  const max = Math.max(1, ...days.flatMap((day) => [day.created, day.closed]))
  const slot = CHART_WIDTH / Math.max(days.length, 1)
  const barWidth = Math.min(16, (slot - 12) / 2)
  const weekday = new Intl.DateTimeFormat(i18n.locale(), { weekday: 'short' })

  return days.map((day, index) => {
    const center = slot * index + slot / 2
    const bar = (value: number, x: number) => {
      const height = (value / max) * chartPlot
      return { value, x, y: CHART_TOP + chartPlot - height, height }
    }

    return {
      key: day.date,
      label: weekday.format(new Date(`${day.date}T12:00:00`)),
      center,
      barWidth,
      created: bar(day.created, center - barWidth - 1),
      closed: bar(day.closed, center + 1),
    }
  })
})

const trendDescription = computed(() =>
  trendDays.value
    .map((day) => i18n.t('%s: %s new, %s closed', day.label, day.created.value, day.closed.value))
    .join('; '),
)

const SITE_LIMIT = 6
const sites = computed(() => data.value?.sites.list.slice(0, SITE_LIMIT) ?? [])
const siteMax = computed(() => Math.max(1, ...sites.value.map((site) => site.count)))

// How tickets came in: a donut on one scale.
const DONUT_SIZE = 108
const DONUT_STROKE = 14
const donutRadius = (DONUT_SIZE - DONUT_STROKE) / 2
const donutLength = 2 * Math.PI * donutRadius
const channelTotal = computed(() =>
  (data.value?.channels ?? []).reduce((sum, channel) => sum + channel.count, 0),
)
const donutArcs = computed(() => {
  let offset = 0

  return (data.value?.channels ?? [])
    .filter((channel) => channel.count > 0)
    .map((channel) => {
      const length = (channel.count / channelTotal.value) * donutLength
      const arc = {
        key: channel.key,
        color: STUDENTHUB_DASHBOARD_CHANNELS[channel.key].color,
        dash: `${Math.max(length - 2, 0.5)} ${donutLength}`,
        offset: -offset,
      }
      offset += length
      return arc
    })
})

// The two small tiles at the end share their row; the channel tile takes what is left.
const smallTileCount = computed(
  () => Number(Boolean(data.value?.approvals)) + Number(Boolean(data.value?.rating)),
)
const channelSpan = computed(() => (smallTileCount.value ? 'sh-span-2' : 'sh-span-4'))
const smallSpan = computed(() => (smallTileCount.value === 1 ? 'sh-span-2' : ''))

const stars = (average: number) => {
  const full = Math.round(average)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}
</script>

<template>
  <div class="sh-dash" data-test-id="studenthub-admin-dashboard">
    <header class="sh-dash-hero">
      <div>
        <h1>{{ $t('Team overview') }}</h1>
        <p class="sh-dash-summary">{{ data ? summary : $t('Loading the figures…') }}</p>
      </div>
      <CommonButton
        variant="secondary"
        prefix-icon="arrow-repeat"
        :disabled="isLoading || isActivityLoading"
        @click="refresh"
      >
        {{ $t('Refresh') }}
      </CommonButton>
    </header>

    <p v-if="loadFailed && !data" class="sh-dash-empty">
      {{ $t('The dashboard could not be loaded. Try Refresh.') }}
    </p>

    <div v-if="data" class="sh-bento-wrap">
      <div class="sh-bento">
        <section class="sh-dash-card sh-bento-hero sh-span-2 sh-rows-2" :aria-label="$t('Open tickets')">
          <div>
            <span class="sh-dash-label">{{ $t('Open tickets') }}</span>
            <div class="sh-dash-big">{{ data.open.total }}</div>
            <span class="sh-dash-sub">
              {{ $t('%s new today · %s closed today', data.open.created_today, data.open.closed_today) }}
            </span>
          </div>
          <ul class="sh-bento-teams">
            <li v-for="team in teams" :key="team.id">
              <CommonLink v-if="team.view_link" :link="`/tickets/view/${team.view_link}`" internal>
                {{ teamLabel(team) }}
              </CommonLink>
              <span v-else>{{ teamLabel(team) }}</span>
              <b>{{ team.count }}</b>
              <span class="sh-dash-track" aria-hidden="true">
                <span :style="{ width: `${share(team.count, teamMax)}%` }" />
              </span>
            </li>
            <li v-if="otherTeamsCount">
              <span>{{ $t('Other teams') }}</span>
              <b>{{ otherTeamsCount }}</b>
            </li>
          </ul>
        </section>

        <section class="sh-dash-card sh-span-2" :aria-label="$t('SLA deadlines')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="exclamation-triangle" size="xs" decorative /></span>
            <h2>{{ $t('SLA deadlines') }}</h2>
          </header>
          <div class="sh-dash-row">
            <span class="sh-dash-big">{{ data.sla.overdue }}<small>{{ $t('overdue') }}</small></span>
            <span class="sh-dash-chip" :data-tone="data.sla.overdue ? 'bad' : 'good'">
              {{ data.sla.overdue ? $t('Needs attention') : $t('All on time') }}
            </span>
          </div>
          <div
            v-if="slaTotal"
            class="sh-dash-stack"
            role="img"
            :aria-label="slaParts.map((part) => `${$t(part.label)} ${part.count}`).join(', ')"
          >
            <span
              v-for="part in slaParts"
              :key="part.key"
              :style="{ width: `${(part.count / slaTotal) * 100}%`, backgroundColor: part.color }"
            />
          </div>
          <ul class="sh-dash-legend">
            <li v-for="part in slaParts" :key="part.key">
              <i :style="{ backgroundColor: part.color }" />{{ $t(part.label) }} <b>{{ part.count }}</b>
            </li>
          </ul>
          <span class="sh-dash-sub">
            {{ $t('Due soon: within %s minutes. No deadline: on hold or without an SLA.', data.settings.escalation_warning_minutes) }}
          </span>
        </section>

        <section class="sh-dash-card" :aria-label="$t('Without an agent')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="person-x" size="xs" decorative /></span>
            <h2>{{ $t('Without an agent') }}</h2>
          </header>
          <span class="sh-dash-big">{{ data.unassigned.count }}</span>
          <span v-if="data.unassigned.oldest_created_at" class="sh-dash-sub" :title="i18n.dateTime(data.unassigned.oldest_created_at)">
            {{ $t('Oldest opened %s', i18n.relativeDateTime(data.unassigned.oldest_created_at)) }}
          </span>
        </section>

        <section class="sh-dash-card" :aria-label="$t('Agents online')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="people-fill" size="xs" decorative /></span>
            <h2>{{ $t('Agents online') }}</h2>
          </header>
          <div class="sh-bento-ring">
            <svg :width="RING_SIZE" :height="RING_SIZE" :viewBox="`0 0 ${RING_SIZE} ${RING_SIZE}`" aria-hidden="true">
              <circle data-track :cx="RING_SIZE / 2" :cy="RING_SIZE / 2" :r="ringRadius" fill="none" :stroke-width="RING_STROKE" />
              <circle
                data-value
                :cx="RING_SIZE / 2"
                :cy="RING_SIZE / 2"
                :r="ringRadius"
                fill="none"
                :stroke-width="RING_STROKE"
                stroke-linecap="round"
                :stroke-dasharray="onlineDash"
                :transform="`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`"
              />
            </svg>
            <div class="sh-bento-ring__text">
              <span class="sh-dash-big">{{ data.agents.online }}<small>{{ $t('of %s', data.agents.total) }}</small></span>
              <CommonLink class="sh-dash-card__link" link="/members" internal>{{ $t('Members') }} →</CommonLink>
            </div>
          </div>
        </section>

        <section class="sh-dash-card sh-span-2" :aria-label="$t('New and closed tickets')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="calendar-range" size="xs" decorative /></span>
            <h2>{{ $t('New and closed, last %s days', data.settings.trend_days) }}</h2>
          </header>
          <svg
            class="sh-bento-chart"
            :viewBox="`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`"
            width="100%"
            role="img"
            :aria-label="trendDescription"
          >
            <line x1="0" :x2="CHART_WIDTH" :y1="CHART_TOP + chartPlot" :y2="CHART_TOP + chartPlot" />
            <g v-for="day in trendDays" :key="day.key">
              <rect data-created :x="day.created.x" :y="day.created.y" :width="day.barWidth" :height="day.created.height" rx="2" />
              <rect data-closed :x="day.closed.x" :y="day.closed.y" :width="day.barWidth" :height="day.closed.height" rx="2" />
              <text data-value :x="day.created.x + day.barWidth / 2" :y="day.created.y - 3" text-anchor="middle">{{ day.created.value }}</text>
              <text data-value :x="day.closed.x + day.barWidth / 2" :y="day.closed.y - 3" text-anchor="middle">{{ day.closed.value }}</text>
              <text :x="day.center" :y="CHART_HEIGHT - 4" text-anchor="middle">{{ day.label }}</text>
            </g>
          </svg>
          <ul class="sh-dash-legend">
            <li><i style="background-color: var(--dash-accent)" />{{ $t('New') }}</li>
            <li><i style="background-color: var(--dash-team)" />{{ $t('Closed') }}</li>
          </ul>
        </section>

        <section class="sh-dash-card sh-span-2" :aria-label="$t('Sites')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="buildings" size="xs" decorative /></span>
            <h2>{{ $t('Open tickets by site') }}</h2>
          </header>
          <ul v-if="sites.length" class="sh-bento-sites">
            <li v-for="site in sites" :key="site.id">
              <CommonLink v-if="site.view_link" :link="`/tickets/view/${site.view_link}`" internal>{{ site.name }}</CommonLink>
              <span v-else>{{ site.name }}</span>
              <span class="sh-dash-track" aria-hidden="true"><span :style="{ width: `${share(site.count, siteMax)}%` }" /></span>
              <span>{{ site.count }}</span>
            </li>
          </ul>
          <p v-else class="sh-dash-empty">{{ $t('No active organisations.') }}</p>
          <span v-if="data.sites.without_site" class="sh-dash-sub">
            {{ $t('Without a site: %s', data.sites.without_site) }}
          </span>
        </section>

        <section class="sh-dash-card" :class="channelSpan" :aria-label="$t('How tickets came in')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="chat-left-text" size="xs" decorative /></span>
            <h2>{{ $t('How tickets came in, last %s days', data.settings.channel_days) }}</h2>
          </header>
          <div v-if="channelTotal" class="sh-bento-ring">
            <svg :width="DONUT_SIZE" :height="DONUT_SIZE" :viewBox="`0 0 ${DONUT_SIZE} ${DONUT_SIZE}`" aria-hidden="true">
              <circle
                v-for="arc in donutArcs"
                :key="arc.key"
                :cx="DONUT_SIZE / 2"
                :cy="DONUT_SIZE / 2"
                :r="donutRadius"
                fill="none"
                :stroke="arc.color"
                :stroke-width="DONUT_STROKE"
                :stroke-dasharray="arc.dash"
                :stroke-dashoffset="arc.offset"
                :transform="`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`"
              />
            </svg>
            <ul class="sh-dash-legend" style="flex-direction: column">
              <li v-for="channel in data.channels" :key="channel.key">
                <i :style="{ backgroundColor: STUDENTHUB_DASHBOARD_CHANNELS[channel.key].color }" />
                {{ $t(STUDENTHUB_DASHBOARD_CHANNELS[channel.key].label) }}
                <b>{{ channel.count }}</b>
                <span class="sh-dash-sub">({{ Math.round((channel.count / channelTotal) * 100) }}%)</span>
              </li>
            </ul>
          </div>
          <p v-else class="sh-dash-empty">{{ $t('No new tickets in this time.') }}</p>
        </section>

        <section v-if="data.approvals" class="sh-dash-card" :class="smallSpan" :aria-label="$t('Waiting for approval')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="check2-circle" size="xs" decorative /></span>
            <h2>{{ $t('Waiting for approval') }}</h2>
          </header>
          <span class="sh-dash-big">{{ data.approvals.waiting }}</span>
          <span v-if="data.approvals.oldest_requested_at" class="sh-dash-sub" :title="i18n.dateTime(data.approvals.oldest_requested_at)">
            {{ $t('Oldest asked %s', i18n.relativeDateTime(data.approvals.oldest_requested_at)) }}
          </span>
        </section>

        <section v-if="data.rating" class="sh-dash-card" :class="smallSpan" :aria-label="$t('Student rating')">
          <header class="sh-dash-card__head">
            <span class="sh-dash-sq"><CommonIcon name="star-fill" size="xs" decorative /></span>
            <h2>{{ $t('Student rating') }}</h2>
          </header>
          <template v-if="data.rating.count && data.rating.average !== null">
            <span class="sh-dash-big">{{ data.rating.average }}<small>/ 5</small></span>
            <span class="sh-bento-stars" role="img" :aria-label="$t('%s of 5 stars', data.rating.average)">{{ stars(data.rating.average) }}</span>
          </template>
          <span class="sh-dash-sub">{{ $t('%s ratings in the last %s days', data.rating.count, data.settings.rating_days) }}</span>
        </section>
      </div>

      <StudenthubDashboardActivity
        :items="activityItems"
        :is-loading="isActivityLoading"
        :load-failed="activityFailed"
      />
    </div>
  </div>
</template>
