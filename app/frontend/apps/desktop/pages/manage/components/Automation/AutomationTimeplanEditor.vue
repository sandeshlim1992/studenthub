<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { DAY_LABELS, DAYS, describeTimeplan, HOURS, MINUTES, type Timeplan } from './timeplan.ts'

// Days, hours and minutes a scheduler job runs.

const timeplan = defineModel<Timeplan>({ required: true })

const toggle = (part: keyof Timeplan, key: string) => {
  timeplan.value = { ...timeplan.value, [part]: { ...timeplan.value[part], [key]: !timeplan.value[part][key] } }
}

const chipClass = (on: boolean) =>
  on
    ? 'border-[var(--sh-app)] bg-[var(--sh-app)] text-white'
    : 'border-[var(--sh-line)] bg-white text-[var(--sh-ink)] hover:border-[var(--sh-app)]'
</script>

<template>
  <div class="flex flex-col gap-3">
    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1 text-xs font-semibold text-[var(--sh-muted)]">{{ $t('Days') }}</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="day in DAYS"
          :key="day"
          type="button"
          class="h-8 min-w-12 rounded-lg border px-2 text-sm font-semibold"
          :class="chipClass(timeplan.days[day])"
          :aria-pressed="timeplan.days[day]"
          @click="toggle('days', day)"
        >
          {{ $t(DAY_LABELS[day]) }}
        </button>
      </div>
    </fieldset>

    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1 text-xs font-semibold text-[var(--sh-muted)]">{{ $t('Hours') }}</legend>
      <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        <button
          v-for="hour in HOURS"
          :key="hour"
          type="button"
          class="h-8 rounded-lg border text-sm font-semibold tabular-nums"
          :class="chipClass(timeplan.hours[String(hour)])"
          :aria-pressed="timeplan.hours[String(hour)]"
          :aria-label="$t('%s o\'clock', hour)"
          @click="toggle('hours', String(hour))"
        >
          {{ String(hour).padStart(2, '0') }}
        </button>
      </div>
    </fieldset>

    <fieldset class="flex flex-col gap-1.5">
      <legend class="mb-1 text-xs font-semibold text-[var(--sh-muted)]">{{ $t('Minutes') }}</legend>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="minute in MINUTES"
          :key="minute"
          type="button"
          class="h-8 min-w-12 rounded-lg border px-2 text-sm font-semibold tabular-nums"
          :class="chipClass(timeplan.minutes[String(minute)])"
          :aria-pressed="timeplan.minutes[String(minute)]"
          @click="toggle('minutes', String(minute))"
        >
          :{{ String(minute).padStart(2, '0') }}
        </button>
      </div>
    </fieldset>

    <p class="text-sm text-[var(--sh-ink-2)]">
      {{ $t('Runs: %s', describeTimeplan(timeplan)) }}
    </p>
  </div>
</template>
