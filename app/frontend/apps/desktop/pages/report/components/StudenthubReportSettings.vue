<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import CommonIcon from '#shared/components/CommonIcon/CommonIcon.vue'

import {
  formatNumber,
  measureLabel,
  periodLabel,
  STEP_LABELS,
  TIME_RANGE_LABELS,
  TIME_RANGES,
  type ReportMetric,
  type ReportPeriod,
  type ReportProfile,
  type ReportTimeRange,
} from '../utils/studenthubReport.ts'

// Student Hub: the Reporting page's left column: which report profile (one list, as admins made
// them, with the tickets each had created in the period), what to measure and the period.

interface Props {
  profiles: ReportProfile[]
  profileId: number | null
  profileCounts: Record<number, number>
  measures: ReportMetric[]
  metricKey: string
  period: ReportPeriod
  canGoForward: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'select-profile': [id: number]
  'select-metric': [key: string]
  'select-time-range': [timeRange: ReportTimeRange]
  step: [direction: 1 | -1]
}>()

// The filter shows once the list is long enough to need it.
const FILTER_FROM = 6

const filter = ref('')

const shownProfiles = computed(() => {
  const query = filter.value.trim().toLowerCase()
  if (!query) return props.profiles

  return props.profiles.filter((profile) => profile.name.toLowerCase().includes(query))
})

const cardClass =
  'flex flex-col gap-2.5 rounded-xl border border-[var(--sh-line)] bg-white p-4 dark:border-gray-900 dark:bg-gray-500'
const headingClass =
  'text-xs font-semibold tracking-wider text-[var(--sh-muted)] uppercase dark:text-neutral-400'
</script>

<template>
  <aside
    :aria-label="$t('Report settings')"
    class="flex w-full flex-col gap-4 @4xl:w-72 @4xl:shrink-0"
  >
    <section :class="cardClass">
      <h2 :class="headingClass">{{ $t('Report profile') }}</h2>
      <label
        v-if="profiles.length >= FILTER_FROM"
        for="sh-report-profile-filter"
        class="flex flex-col"
      >
        <span class="sr-only">{{ $t('Find a profile') }}</span>
        <input
          id="sh-report-profile-filter"
          v-model="filter"
          type="search"
          :placeholder="$t('Find a profile')"
          class="h-9 rounded-lg border border-[var(--sh-line)] bg-white px-2.5 text-sm text-[var(--sh-ink)] dark:border-gray-900 dark:bg-gray-600 dark:text-white"
        />
      </label>
      <fieldset class="m-0 flex flex-col gap-0.5 border-0 p-0">
        <legend class="sr-only">{{ $t('Report profile') }}</legend>
        <label
          v-for="profile in shownProfiles"
          :key="profile.id"
          :for="`sh-report-profile-${profile.id}`"
          class="flex cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-1.5"
          :class="
            profile.id === profileId
              ? 'bg-[var(--sh-app-soft)] font-semibold dark:bg-gray-600'
              : 'hover:bg-[var(--sh-row-hover)] dark:hover:bg-gray-600'
          "
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <input
              :id="`sh-report-profile-${profile.id}`"
              type="radio"
              name="sh-report-profile"
              :value="profile.id"
              :checked="profile.id === profileId"
              class="shrink-0 accent-[var(--sh-app)]"
              @change="emit('select-profile', profile.id)"
            />
            <span class="min-w-0 break-words">{{ profile.name }}</span>
          </span>
          <span
            v-if="profileCounts[profile.id] !== undefined"
            class="shrink-0 font-normal text-[var(--sh-muted)] tabular-nums dark:text-neutral-400"
          >
            {{ formatNumber(profileCounts[profile.id]) }}
            <span class="sr-only">{{ $t('tickets created') }}</span>
          </span>
        </label>
        <p v-if="!shownProfiles.length" class="px-2.5 py-1.5 text-[var(--sh-muted)]">
          {{ $t('No profile matches.') }}
        </p>
      </fieldset>
    </section>

    <section :class="cardClass">
      <fieldset class="m-0 flex flex-col gap-1 border-0 p-0">
        <legend :class="headingClass" class="mb-1.5">{{ $t('Measure') }}</legend>
        <label
          v-for="measure in measures"
          :key="measure.name"
          :for="`sh-report-measure-${measure.name}`"
          class="flex cursor-pointer items-center gap-2.5 py-1"
        >
          <input
            :id="`sh-report-measure-${measure.name}`"
            type="radio"
            name="sh-report-measure"
            :value="measure.name"
            :checked="measure.name === metricKey"
            class="accent-[var(--sh-app)]"
            @change="emit('select-metric', measure.name)"
          />
          {{ $t(measureLabel(measure)) }}
        </label>
      </fieldset>
    </section>

    <section :class="cardClass" class="gap-3">
      <h2 :class="headingClass">{{ $t('Period') }}</h2>
      <div role="group" :aria-label="$t('Period')" class="grid grid-cols-3 gap-1">
        <button
          v-for="timeRange in TIME_RANGES"
          :key="timeRange"
          type="button"
          :aria-pressed="period.timeRange === timeRange"
          class="h-8 rounded-lg text-sm"
          :class="[
            timeRange === 'realtime' ? 'col-span-2' : '',
            period.timeRange === timeRange
              ? 'bg-app font-semibold text-on-app'
              : 'border border-[var(--sh-line)] bg-white text-[var(--sh-ink)] hover:bg-[var(--sh-row-hover)] dark:border-gray-900 dark:bg-gray-600 dark:text-white',
          ]"
          @click="emit('select-time-range', timeRange)"
        >
          {{ $t(TIME_RANGE_LABELS[timeRange]) }}
        </button>
      </div>
      <div
        v-if="period.timeRange !== 'realtime'"
        class="flex items-center justify-between gap-2 rounded-lg border border-[var(--sh-line)] p-1 dark:border-gray-900"
      >
        <button
          type="button"
          :aria-label="$t(STEP_LABELS[period.timeRange][0])"
          class="grid size-8 place-items-center rounded-md hover:bg-[var(--sh-row-hover)] dark:hover:bg-gray-600"
          @click="emit('step', -1)"
        >
          <CommonIcon name="chevron-left" size="tiny" decorative />
        </button>
        <span class="text-center font-semibold" aria-live="polite">{{ periodLabel(period) }}</span>
        <button
          type="button"
          :aria-label="$t(STEP_LABELS[period.timeRange][1])"
          :disabled="!canGoForward"
          class="grid size-8 place-items-center rounded-md hover:bg-[var(--sh-row-hover)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-gray-600"
          @click="emit('step', 1)"
        >
          <CommonIcon name="chevron-right" size="tiny" decorative />
        </button>
      </div>
      <p v-else class="text-xs text-[var(--sh-muted)] dark:text-neutral-400">
        {{ $t('The last 60 minutes, minute by minute.') }}
      </p>
    </section>
  </aside>
</template>
