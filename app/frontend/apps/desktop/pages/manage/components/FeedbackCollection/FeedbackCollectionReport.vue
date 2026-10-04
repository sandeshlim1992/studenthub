<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { feedbackApi } from './api.ts'

import type { FeedbackReport } from './types.ts'

const from = ref('')
const to = ref('')
const report = ref<FeedbackReport | null>(null)
const isLoading = ref(false)
const errorText = ref('')

const load = async () => {
  isLoading.value = true
  errorText.value = ''
  try {
    report.value = await feedbackApi.report(from.value || undefined, to.value || undefined)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : String(error)
  } finally {
    isLoading.value = false
  }
}

const setRange = (days: number | null) => {
  if (days === null) {
    from.value = ''
    to.value = ''
  } else {
    const start = new Date()
    start.setDate(start.getDate() - days + 1)
    from.value = start.toISOString().slice(0, 10)
    to.value = new Date().toISOString().slice(0, 10)
  }
  load()
}

const responseRate = computed(() => {
  if (!report.value || report.value.requests === 0) return null
  return Math.round((report.value.responses / report.value.requests) * 100)
})

const distribution = computed(() => {
  if (!report.value) return []
  const totalResponses = report.value.responses || 1
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = report.value?.distribution[String(rating)] ?? 0
    return { rating, count, percent: Math.round((count / totalResponses) * 100) }
  })
})

const maxMonth = computed(() => Math.max(1, ...(report.value?.by_month.map((row) => row.count) ?? [1])))

onMounted(load)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex flex-wrap items-end gap-3">
      <label for="feedback-report-from" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('From') }}
        <input
id="feedback-report-from"
          v-model="from"
          type="date"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
      <label for="feedback-report-to" class="flex flex-col gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
        {{ $t('To') }}
        <input
id="feedback-report-to"
          v-model="to"
          type="date"
          class="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm font-normal text-slate-800 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
      </label>
      <button
        type="button"
        class="h-9 cursor-pointer rounded-lg bg-blue-800 px-4 text-sm font-semibold text-white hover:bg-blue-900"
        @click="load"
      >
        {{ $t('Apply') }}
      </button>
      <div class="flex flex-wrap gap-1.5 text-sm">
        <button
          v-for="range in [{ days: 30, label: __('Last 30 days') }, { days: 90, label: __('Last 90 days') }, { days: null, label: __('All time') }]"
          :key="range.label"
          type="button"
          class="h-9 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          @click="setRange(range.days)"
        >
          {{ $t(range.label) }}
        </button>
      </div>
    </div>

    <div
      v-if="errorText"
      role="alert"
      class="rounded-lg bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
    >
      {{ errorText }}
    </div>

    <template v-if="report">
      <div class="grid gap-4 sm:grid-cols-3" :class="{ 'opacity-60': isLoading }">
        <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{{ $t('Average rating') }}</div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-bold tabular-nums">{{ report.average ?? '–' }}</span>
            <span class="text-sm text-slate-600 dark:text-slate-400">/ 5</span>
            <CommonIcon v-if="report.average" name="star-fill" class="h-5 w-5 self-center text-amber-500" />
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{{ $t('Responses') }}</div>
          <div class="mt-2 text-3xl font-bold tabular-nums">{{ report.responses }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <div class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">{{ $t('Response rate') }}</div>
          <div class="mt-2 flex items-baseline gap-2">
            <span class="text-3xl font-bold tabular-nums">{{ responseRate === null ? '–' : `${responseRate}%` }}</span>
            <span class="text-sm text-slate-600 dark:text-slate-400">{{ $t('of %s requests', report.requests) }}</span>
          </div>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-4 text-sm font-bold">{{ $t('Ratings') }}</h3>
          <ul class="flex flex-col gap-2.5">
            <li v-for="row in distribution" :key="row.rating" class="grid grid-cols-[64px_1fr_72px] items-center gap-3 text-sm">
              <span class="inline-flex items-center gap-1 font-semibold tabular-nums">
                {{ row.rating }} <CommonIcon name="star-fill" class="h-3.5 w-3.5 text-amber-500" />
              </span>
              <span class="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span class="block h-full rounded-full bg-amber-500" :style="{ width: `${row.percent}%` }" />
              </span>
              <span class="text-right tabular-nums text-slate-600 dark:text-slate-400">{{ row.count }} · {{ row.percent }}%</span>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <h3 class="mb-4 text-sm font-bold">{{ $t('By month') }}</h3>
          <p v-if="report.by_month.length === 0" class="text-sm text-slate-600 dark:text-slate-400">{{ $t('No ratings in this period.') }}</p>
          <ul v-else class="flex flex-col gap-2">
            <li v-for="row in report.by_month" :key="row.month" class="grid grid-cols-[72px_1fr_96px] items-center gap-3 text-sm">
              <span class="tabular-nums text-slate-700 dark:text-slate-300">{{ row.month }}</span>
              <span class="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <span class="block h-full rounded-full bg-blue-800 dark:bg-blue-400" :style="{ width: `${Math.round((row.count / maxMonth) * 100)}%` }" />
              </span>
              <span class="text-right tabular-nums text-slate-600 dark:text-slate-400">{{ row.count }} · ★ {{ row.average }}</span>
            </li>
          </ul>
        </section>

        <section
          v-for="block in [{ title: __('By agent'), rows: report.by_agent, first: __('Agent') }, { title: __('By group'), rows: report.by_group, first: __('Group') }]"
          :key="block.title"
          class="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
        >
          <h3 class="px-5 pt-5 pb-3 text-sm font-bold">{{ $t(block.title) }}</h3>
          <p v-if="block.rows.length === 0" class="px-5 pb-5 text-sm text-slate-600 dark:text-slate-400">{{ $t('No ratings in this period.') }}</p>
          <table v-else class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-slate-600 dark:text-slate-400">
                <th scope="col" class="px-5 py-2 font-semibold">{{ $t(block.first) }}</th>
                <th scope="col" class="px-5 py-2 text-right font-semibold">{{ $t('Responses') }}</th>
                <th scope="col" class="px-5 py-2 text-right font-semibold">{{ $t('Average') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in block.rows" :key="row.name" class="border-t border-slate-100 dark:border-slate-800">
                <td class="px-5 py-2">{{ row.name }}</td>
                <td class="px-5 py-2 text-right tabular-nums">{{ row.count }}</td>
                <td class="px-5 py-2 text-right tabular-nums">★ {{ row.average.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </template>
  </div>
</template>
