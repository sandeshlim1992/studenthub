<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import type { ReportTile } from '../utils/studenthubReport.ts'

// Student Hub: the Reporting page's four figures over the chart.

defineProps<{
  tiles: ReportTile[]
}>()
</script>

<template>
  <dl class="m-0 grid grid-cols-2 gap-3 @5xl:grid-cols-4">
    <div
      v-for="tile in tiles"
      :key="tile.label"
      class="flex min-w-0 flex-col gap-0.5 rounded-xl border border-[var(--sh-line)] bg-white px-4 py-3.5 dark:border-gray-900 dark:bg-gray-500"
    >
      <dt class="flex items-center gap-1.5 text-xs text-[var(--sh-muted)] dark:text-neutral-400">
        <span
          v-if="tile.color"
          aria-hidden="true"
          class="h-[3px] w-2.5 shrink-0 rounded-sm"
          :style="{ background: tile.color }"
        ></span>
        {{ tile.label }}
      </dt>
      <dd
        class="sh-condensed m-0 truncate text-[2.375rem] leading-tight font-semibold text-[var(--sh-ink)] tabular-nums dark:text-white"
      >
        {{ tile.value }}
      </dd>
      <dd class="m-0 text-xs text-[var(--sh-muted)] dark:text-neutral-400">{{ tile.note }}</dd>
    </div>
  </dl>
</template>
