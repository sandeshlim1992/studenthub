<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { i18n } from '#shared/i18n.ts'

import {
  formatWait,
  type ManagerDashboard,
} from '#desktop/pages/dashboard/utils/studenthubManagerDashboard.ts'

// Student Hub manager dashboard: shown instead of the request card when nothing is waiting.
// The last 30 days: decided, approved, how long requests waited for the manager (compared with
// the 30 days before), decisions per week and per team.
interface Props {
  data: ManagerDashboard
}

const props = defineProps<Props>()

const month = computed(() => props.data.month)
const decisions = computed(() => props.data.decisions)
const warningHours = computed(() => props.data.settings.waiting_warning_hours)

const decidedChange = computed(() => month.value.decided - month.value.previous.decided)

const medianChange = computed(() => {
  const now = month.value.median_wait_seconds
  const before = month.value.previous.median_wait_seconds
  if (now === null || before === null || now === before) return null

  return { faster: now < before, by: formatWait(Math.abs(now - before)) }
})

const weekScale = computed(() =>
  Math.max(4, ...month.value.per_week.map((week) => week.approved + week.denied)),
)

const weeks = computed(() =>
  month.value.per_week.map((week) => ({
    ...week,
    label: new Date(`${week.week_start}T00:00:00`).toLocaleDateString(i18n.locale(), {
      day: 'numeric',
      month: 'short',
    }),
    approvedHeight: `${(week.approved / weekScale.value) * 100}%`,
    deniedHeight: `${(week.denied / weekScale.value) * 100}%`,
  })),
)

const weekSummary = computed(() =>
  month.value.per_week.map((week) => week.approved + week.denied).join(', '),
)

const teamMax = computed(() => Math.max(1, ...month.value.by_team.map((team) => team.decided)))
</script>

<template>
  <article
    aria-labelledby="sh-manager-month-title"
    class="flex min-w-0 flex-col gap-[22px] rounded-xl border border-[var(--sh-line)] bg-white px-7 py-6 shadow-[0_1px_2px_rgb(14_15_17/0.06)]"
    data-test-id="manager-month"
  >
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <h2
        id="sh-manager-month-title"
        class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]"
      >
        {{ $t('Your month in review') }}
      </h2>
      <span class="text-sm text-[var(--sh-ink-2)]">{{
        $t('Last %s days', data.settings.decisions_period_days)
      }}</span>
    </div>

    <p v-if="!month.decided" class="text-[var(--sh-ink-2)]">
      {{
        $t(
          'You have not decided any requests in the last %s days.',
          data.settings.decisions_period_days,
        )
      }}
    </p>

    <template v-else>
      <dl class="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-6 gap-y-4 text-sm">
        <div>
          <dt class="text-[var(--sh-muted)]">{{ $t('Decided') }}</dt>
          <dd class="sh-condensed text-4xl leading-none font-bold text-[var(--sh-ink)]">
            {{ month.decided }}
          </dd>
          <dd v-if="decidedChange" class="mt-1 text-[var(--sh-ink-2)]">
            {{
              decidedChange > 0
                ? $t('%s more than the 30 days before', decidedChange)
                : $t('%s fewer than the 30 days before', -decidedChange)
            }}
          </dd>
        </div>
        <div>
          <dt class="text-[var(--sh-muted)]">{{ $t('Approved') }}</dt>
          <dd class="sh-condensed text-4xl leading-none font-bold text-[var(--sh-ink)]">
            {{ decisions.approval_rate }}%
          </dd>
          <dd class="mt-1 text-[var(--sh-ink-2)]">
            {{ $t('%s approved, %s denied', decisions.approved, decisions.denied) }}
          </dd>
        </div>
        <div>
          <dt class="text-[var(--sh-muted)]">{{ $t('Median wait for you') }}</dt>
          <dd class="sh-condensed text-4xl leading-none font-bold text-[var(--sh-ink)]">
            {{ formatWait(month.median_wait_seconds) }}
          </dd>
          <dd
            v-if="medianChange"
            class="mt-1 font-semibold"
            :class="medianChange.faster ? 'text-[#16794a]' : 'text-[#8f5b00]'"
          >
            {{
              medianChange.faster
                ? $t('%s faster than before', medianChange.by)
                : $t('%s slower than before', medianChange.by)
            }}
          </dd>
        </div>
        <div>
          <dt class="text-[var(--sh-muted)]">{{ $t('Longest wait') }}</dt>
          <dd class="sh-condensed text-4xl leading-none font-bold text-[var(--sh-ink)]">
            {{ formatWait(month.longest_wait_seconds) }}
          </dd>
          <dd class="mt-1 text-[var(--sh-ink-2)]">
            {{
              month.over_warning
                ? $t('%s waited over %s hours', month.over_warning, warningHours)
                : $t('None waited over %s hours', warningHours)
            }}
          </dd>
        </div>
      </dl>

      <div class="flex flex-wrap gap-x-8 gap-y-6 border-t border-[#e8eaee] pt-[18px]">
        <section aria-labelledby="sh-manager-weeks-title" class="min-w-0 flex-[3_1_340px]">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 id="sh-manager-weeks-title" class="text-[15px] font-bold text-[var(--sh-ink)]">
              {{ $t('Decisions per week') }}
            </h3>
            <div class="flex gap-3.5 text-sm text-[var(--sh-ink-2)]">
              <span class="inline-flex items-center gap-1.5"
                ><span class="size-2.5 rounded-sm bg-[var(--sh-app)]"></span
                >{{ $t('Approved') }}</span
              >
              <span class="inline-flex items-center gap-1.5"
                ><span class="size-2.5 rounded-sm bg-[#c2560c]"></span>{{ $t('Denied') }}</span
              >
            </div>
          </div>
          <div
            role="img"
            class="mt-3 grid grid-cols-5 items-end gap-0 border-b border-[#8f949d]"
            :aria-label="$t('Decisions per week, oldest first: %s', weekSummary)"
          >
            <div
              v-for="week in weeks"
              :key="week.week_start"
              class="flex h-36 flex-col justify-end px-[24%]"
            >
              <span
                v-if="week.denied"
                class="mb-0.5 grid place-items-center rounded-t-sm bg-[#c2560c] text-xs font-semibold text-white"
                :style="{ height: week.deniedHeight }"
              >
                {{ week.denied }}
              </span>
              <span
                v-if="week.approved"
                class="grid place-items-center bg-[var(--sh-app)] text-xs font-semibold text-white"
                :class="{ 'rounded-t-sm': !week.denied }"
                :style="{ height: week.approvedHeight }"
              >
                {{ week.approved }}
              </span>
            </div>
          </div>
          <div
            class="mt-1.5 grid grid-cols-5 text-center text-xs text-[var(--sh-ink-2)]"
            aria-hidden="true"
          >
            <span v-for="week in weeks" :key="week.week_start">{{ week.label }}</span>
          </div>
        </section>

        <section
          v-if="month.by_team.length"
          aria-labelledby="sh-manager-teams-title"
          class="min-w-0 flex-[2_1_220px]"
        >
          <h3 id="sh-manager-teams-title" class="text-[15px] font-bold text-[var(--sh-ink)]">
            {{ $t('By team') }}
          </h3>
          <ul class="mt-3 flex flex-col gap-3 text-sm">
            <li v-for="team in month.by_team" :key="team.name ?? '-'" class="flex flex-col gap-1">
              <span class="flex justify-between gap-2">
                <span class="font-semibold text-[var(--sh-ink)]">{{
                  team.name ?? $t('No team')
                }}</span>
                <span class="text-[var(--sh-ink-2)]">{{
                  $t('%s · %s approved', team.decided, team.approved)
                }}</span>
              </span>
              <span aria-hidden="true" class="h-2 overflow-hidden rounded bg-[#eef0f3]">
                <span
                  class="block h-full rounded bg-[var(--sh-app)]"
                  :style="{ width: `${(team.decided / teamMax) * 100}%` }"
                ></span>
              </span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </article>
</template>
