<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import CommonIcon from '#shared/components/CommonIcon/CommonIcon.vue'
import { i18n } from '#shared/i18n.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import LayoutContent from '#desktop/components/layout/LayoutContent.vue'

import StudenthubReportChart from '../components/StudenthubReportChart.vue'
import StudenthubReportSettings from '../components/StudenthubReportSettings.vue'
import StudenthubReportTickets from '../components/StudenthubReportTickets.vue'
import StudenthubReportTiles from '../components/StudenthubReportTiles.vue'
import { useStudenthubReport } from '../composables/useStudenthubReport.ts'
import {
  backlogChanges,
  bucketLabels,
  countTiles,
  formatNumber,
  measureLabel,
  periodLabel,
  SERIES_STYLES,
  seriesTiles,
  type ReportTimeRange,
} from '../utils/studenthubReport.ts'

// Student Hub: Reporting (design A, "filter column"). On the left the report profile, the measure
// and the period; on the right the profile's figures, a chart over the period and the tickets
// behind a series. All of it is Zammad's own reporting (useStudenthubReport), which needs
// Elasticsearch and a report profile; without them the page says why instead.

const {
  isConfigLoading,
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
  isTicketsLoading,
  stateNames,
  selectProfile,
  selectMetric,
  selectTimeRange,
  step,
  selectTicketsBackend,
  showMoreTickets,
  setLive,
  downloadExcel,
} = useStudenthubReport()

// The link to Report Profiles, for those who may open it (the same as its route).
const canManageProfiles = computed(() =>
  useSessionStore().hasPermission(['admin', 'admin.report_profile']),
)

const isCount = computed(() => metric.value?.name === 'count')

const labels = computed(() => bucketLabels(period.value))

const tiles = computed(() => {
  if (!metric.value) return []

  return isCount.value
    ? countTiles(figures.value, period.value, labels.value)
    : seriesTiles(metric.value, figures.value)
})

// Ticket count shows created and closed (the other series are in the ticket list); the other
// measures show all their series.
const chartSeries = computed(() => {
  const backends = metric.value?.backend ?? []
  const shown = isCount.value
    ? backends.filter((backend) => ['count::created', 'count::closed'].includes(backend.name))
    : backends

  return shown.map((backend, index) => {
    const style = SERIES_STYLES[index % SERIES_STYLES.length]

    return {
      name: backend.name,
      display: i18n.t(backend.display),
      values: figures.value[backend.name] ?? [],
      color: style.color,
      dash: style.dash,
      width: style.width,
    }
  })
})

const BY_LABELS: Record<ReportTimeRange, string> = {
  year: __('by month'),
  month: __('by day'),
  week: __('by day'),
  day: __('by hour'),
  realtime: __('by minute'),
}

const chartTitle = computed(() => {
  if (isCount.value) return i18n.t('Created and closed')
  return metric.value ? i18n.t(measureLabel(metric.value)) : ''
})

const chartSummary = computed(() =>
  i18n.t(
    'Line chart for %s: %s.',
    periodLabel(period.value),
    chartSeries.value
      .map((series) => `${series.display} ${formatNumber(totals.value[series.name] ?? 0)}`)
      .join(', '),
  ),
)

// Created minus closed for each part of the period (too crowded for the minutes of the last hour).
const backlog = computed(() =>
  isCount.value && labels.value.length <= 31 ? backlogChanges(figures.value) : null,
)

const ticketTabs = computed(() =>
  ticketBackends.value.map((backend) => ({
    name: backend.name,
    display: backend.display,
    total: totals.value[backend.name],
  })),
)

const subtitle = computed(() => {
  const parts = [metric.value ? i18n.t(measureLabel(metric.value)) : '', periodLabel(period.value)]
  if (updatedAt.value) {
    parts.push(
      i18n.t(
        'updated %s',
        updatedAt.value.toLocaleTimeString(i18n.locale(), { hour: '2-digit', minute: '2-digit' }),
      ),
    )
  }

  return parts.filter(Boolean).join(' · ')
})

const buttonClass =
  'flex h-9 items-center gap-2 rounded-lg border border-[var(--sh-line)] bg-white px-3.5 font-semibold text-[var(--sh-ink)] hover:bg-[var(--sh-row-hover)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-900 dark:bg-gray-500 dark:text-white'
</script>

<template>
  <LayoutContent
    :breadcrumb-items="[{ label: __('Reporting') }]"
    background-variant="tertiary"
    width="full"
  >
    <div class="@container w-full">
      <div
        class="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-6 py-6 text-sm text-[var(--sh-ink)] @4xl:flex-row @4xl:items-start dark:text-white"
      >
        <!-- Why there is nothing to show (Zammad's reason), instead of empty figures -->
        <div
          v-if="configError"
          role="alert"
          class="flex w-full items-start gap-3 rounded-xl border border-amber-300 bg-white p-5 dark:border-amber-800 dark:bg-gray-500"
        >
          <CommonIcon
            name="exclamation-triangle"
            class="size-5 shrink-0 text-amber-600"
            decorative
          />
          <div class="flex flex-col gap-1">
            <p class="m-0 font-bold">{{ $t(configError) }}</p>
            <p
              v-if="configError.includes('Elasticsearch')"
              class="m-0 text-[var(--sh-muted)] dark:text-neutral-400"
            >
              {{
                $t(
                  'Reports are worked out by Elasticsearch, which this server does not have yet. Whoever looks after the server can set it up.',
                )
              }}
            </p>
            <p
              v-else-if="configError.includes('report profiles')"
              class="m-0 text-[var(--sh-muted)] dark:text-neutral-400"
            >
              {{ $t('A report profile says which tickets a report counts.') }}
              <RouterLink
                v-if="canManageProfiles"
                to="/manage/report_profiles"
                class="font-semibold text-[var(--sh-app)] hover:underline dark:text-blue-300"
              >
                {{ $t('Create one under Administration → Report Profiles.') }}
              </RouterLink>
            </p>
          </div>
        </div>

        <p v-else-if="isConfigLoading" class="m-0 text-[var(--sh-muted)]">
          {{ $t('Loading the report…') }}
        </p>

        <template v-else>
          <StudenthubReportSettings
            :profiles="profiles"
            :profile-id="profileId"
            :profile-counts="profileCounts"
            :measures="measures"
            :metric-key="metricKey"
            :period="period"
            :can-go-forward="canGoForward"
            @select-profile="selectProfile"
            @select-metric="selectMetric"
            @select-time-range="selectTimeRange"
            @step="step"
          />

          <div class="flex min-w-0 grow flex-col gap-5">
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div class="min-w-0">
                <h1 class="text-2xl font-bold tracking-tight">{{ profile?.name }}</h1>
                <p class="m-0 mt-1 text-[var(--sh-muted)] dark:text-neutral-400">{{ subtitle }}</p>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  :aria-pressed="isLive"
                  :class="buttonClass"
                  @click="setLive(!isLive)"
                >
                  <span
                    aria-hidden="true"
                    class="size-2 rounded-full"
                    :class="isLive ? 'bg-[#16794a]' : 'bg-[#9aa1ad]'"
                  ></span>
                  {{ $t('Live') }}
                </button>
                <button
                  type="button"
                  :class="buttonClass"
                  :disabled="!ticketsBackend || !ticketsCount"
                  @click="downloadExcel"
                >
                  <CommonIcon name="download" size="tiny" decorative />
                  {{ $t('Download Excel') }}
                </button>
              </div>
            </div>

            <p
              v-if="dataError"
              role="alert"
              class="m-0 rounded-xl border border-red-300 bg-red-50 px-4 py-3 font-semibold text-red-800 dark:border-red-800 dark:bg-gray-500 dark:text-red-200"
            >
              {{ $t('The report could not be loaded: %s', dataError) }}
            </p>

            <StudenthubReportTiles :tiles="tiles" />

            <StudenthubReportChart
              :title="chartTitle"
              :subtitle="$t(BY_LABELS[period.timeRange])"
              :summary="chartSummary"
              :labels="labels"
              :series="chartSeries"
              :backlog="backlog"
            />

            <StudenthubReportTickets
              :backends="ticketTabs"
              :selected="ticketsBackend"
              :tickets="tickets"
              :count="ticketsCount"
              :visible-rows="visibleRows"
              :loading="isTicketsLoading"
              :state-names="stateNames"
              @select="selectTicketsBackend"
              @show-more="showMoreTickets"
            />
          </div>
        </template>
      </div>
    </div>
  </LayoutContent>
</template>
