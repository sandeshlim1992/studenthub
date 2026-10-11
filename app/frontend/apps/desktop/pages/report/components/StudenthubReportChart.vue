<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import { formatNumber, niceMax, type BacklogTone } from '../utils/studenthubReport.ts'

// Student Hub: the Reporting page's line chart, one line per series over the parts of the period
// (straight lines between the real numbers). For ticket counts a row under it shows how the
// backlog changed in each part. Pointing at the chart shows the numbers there; screen readers get
// them as a table.

export interface ReportChartSeries {
  name: string
  display: string
  values: number[]
  color: string
  dash: string
  width: number
}

interface Props {
  title: string
  subtitle: string
  summary: string
  labels: string[]
  series: ReportChartSeries[]
  backlog?: { label: string; tone: BacklogTone }[] | null
}

const props = defineProps<Props>()

const WIDTH = 760
const HEIGHT = 270
const LEFT = 44
const RIGHT = 748
const TOP = 12
const BOTTOM = 240
// At most this many names along the bottom; the others are left out.
const MAX_AXIS_LABELS = 12

const max = computed(() => niceMax(Math.max(0, ...props.series.flatMap((series) => series.values))))

const x = (index: number) =>
  props.labels.length > 1
    ? LEFT + (index * (RIGHT - LEFT)) / (props.labels.length - 1)
    : (LEFT + RIGHT) / 2

const y = (value: number) => BOTTOM - ((value || 0) / max.value) * (BOTTOM - TOP)

const gridLines = computed(() =>
  [0, 1, 2, 3, 4].map((step) => {
    const value = (max.value / 4) * step
    return { y: y(value), label: formatNumber(value) }
  }),
)

const axisLabels = computed(() => {
  const every = Math.ceil(props.labels.length / MAX_AXIS_LABELS)
  return props.labels
    .map((label, index) => ({ label, x: x(index), index }))
    .filter((item) => item.index % every === 0)
})

const linePath = (values: number[]) =>
  props.labels
    .map(
      (_, index) =>
        `${index ? 'L' : 'M'}${x(index).toFixed(1)} ${y(values[index] ?? 0).toFixed(1)}`,
    )
    .join(' ')

const lines = computed(() =>
  props.series.map((series) => Object.assign({}, series, { path: linePath(series.values) })),
)

const area = computed(() => {
  const first = lines.value[0]
  if (!first || !props.labels.length) return ''

  return `${first.path} L${x(props.labels.length - 1).toFixed(1)} ${BOTTOM} L${x(0).toFixed(1)} ${BOTTOM} Z`
})

const slotWidth = computed(() =>
  props.labels.length > 1 ? (RIGHT - LEFT) / (props.labels.length - 1) : RIGHT - LEFT,
)

const hovered = ref<number | null>(null)

// Where the read-out sits, as a share of the chart's width (it scales with the page).
const percent = (value: number) => `${(value / WIDTH) * 100}%`

const readout = computed(() => {
  if (hovered.value === null) return null

  const index = hovered.value
  return {
    left: percent(x(index)),
    // From the middle on, the box opens to the left of the line.
    alignEnd: index > props.labels.length / 2,
    label: props.labels[index],
    values: props.series.map((series) => ({
      name: series.name,
      display: series.display,
      color: series.color,
      value: formatNumber(series.values[index] ?? 0),
    })),
  }
})

const toneClass: Record<BacklogTone, string> = {
  up: 'font-semibold text-[#b45309] dark:text-amber-400',
  down: 'font-semibold text-[#16794a] dark:text-green-400',
  none: 'text-[#9aa1ad]',
}
</script>

<template>
  <figure
    class="m-0 rounded-xl border border-[var(--sh-line)] bg-white px-5 pt-4 pb-3 dark:border-gray-900 dark:bg-gray-500"
  >
    <figcaption class="mb-2 flex flex-wrap items-center justify-between gap-2">
      <span class="font-semibold">
        {{ title }}
        <span class="font-normal text-[var(--sh-muted)] dark:text-neutral-400"
          >· {{ subtitle }}</span
        >
      </span>
      <span class="flex flex-wrap gap-4 text-xs text-[var(--sh-muted)] dark:text-neutral-400">
        <span v-for="item in series" :key="item.name" class="flex items-center gap-1.5">
          <svg aria-hidden="true" width="18" height="6" viewBox="0 0 18 6">
            <line
              x1="0"
              y1="3"
              x2="18"
              y2="3"
              :stroke-dasharray="item.dash || undefined"
              :stroke-width="item.width"
              :style="{ stroke: item.color }"
            />
          </svg>
          {{ item.display }}
        </span>
      </span>
    </figcaption>

    <div class="relative">
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        role="img"
        :aria-label="summary"
        class="block h-auto w-full select-none"
      >
        <g v-for="line in gridLines" :key="line.y">
          <line
            :x1="LEFT"
            :x2="RIGHT"
            :y1="line.y"
            :y2="line.y"
            class="stroke-[#eceff3] dark:stroke-gray-400"
          />
          <text
            :x="LEFT - 8"
            :y="line.y + 4"
            text-anchor="end"
            font-size="11"
            class="fill-[#5f6878] dark:fill-neutral-400"
          >
            {{ line.label }}
          </text>
        </g>

        <path v-if="area" :d="area" fill-opacity="0.08" :style="{ fill: lines[0].color }" />
        <path
          v-for="line in lines"
          :key="line.name"
          :d="line.path"
          fill="none"
          stroke-linejoin="round"
          :stroke-width="line.width"
          :stroke-dasharray="line.dash || undefined"
          :style="{ stroke: line.color }"
        />

        <line
          v-if="hovered !== null"
          :x1="x(hovered)"
          :x2="x(hovered)"
          :y1="TOP"
          :y2="BOTTOM"
          stroke-dasharray="3 3"
          class="stroke-[#5f6878] dark:stroke-neutral-400"
        />
        <template v-if="hovered !== null">
          <circle
            v-for="line in lines"
            :key="`dot-${line.name}`"
            :cx="x(hovered)"
            :cy="y(line.values[hovered] ?? 0)"
            r="4"
            stroke="#fff"
            stroke-width="2"
            :style="{ fill: line.color }"
          />
        </template>

        <text
          v-for="label in axisLabels"
          :key="`label-${label.index}`"
          :x="label.x"
          y="262"
          text-anchor="middle"
          font-size="11"
          class="fill-[#5f6878] dark:fill-neutral-400"
        >
          {{ label.label }}
        </text>

        <!-- eslint-disable-next-line vuejs-accessibility/mouse-events-have-key-events, vuejs-accessibility/no-static-element-interactions -->
        <rect
          v-for="(_, index) in labels"
          :key="`hit-${index}`"
          :x="x(index) - slotWidth / 2"
          :y="TOP"
          :width="slotWidth"
          :height="BOTTOM - TOP"
          fill="transparent"
          @mouseenter="hovered = index"
          @mouseleave="hovered = null"
        />
      </svg>

      <div
        v-if="readout"
        aria-hidden="true"
        class="pointer-events-none absolute top-1 z-10 min-w-36 rounded-lg bg-[#1d2330] px-3 py-2 text-xs text-white shadow-lg"
        :style="{
          left: readout.left,
          transform: readout.alignEnd ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
        }"
      >
        <p class="mb-1 font-semibold">{{ readout.label }}</p>
        <p
          v-for="value in readout.values"
          :key="value.name"
          class="flex items-center justify-between gap-3"
        >
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full" :style="{ background: value.color }"></span>
            {{ value.display }}
          </span>
          <span class="font-semibold tabular-nums">{{ value.value }}</span>
        </p>
      </div>
    </div>

    <div
      v-if="backlog?.length"
      aria-hidden="true"
      class="mt-1.5 border-t border-[#eceff3] pt-2 text-xs dark:border-gray-400"
    >
      <p class="m-0 mb-1 text-[var(--sh-muted)] dark:text-neutral-400">
        {{ $t('Backlog change (created minus closed)') }}
      </p>
      <div class="relative h-4 tabular-nums">
        <span
          v-for="(change, index) in backlog"
          :key="`backlog-${index}`"
          class="absolute"
          :class="toneClass[change.tone]"
          :style="{ left: percent(x(index)), transform: 'translateX(-50%)' }"
        >
          {{ change.label }}
        </span>
      </div>
    </div>

    <table class="sr-only">
      <caption>
        {{
          title
        }},
        {{
          subtitle
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col">{{ $t('When') }}</th>
          <th v-for="item in series" :key="`head-${item.name}`" scope="col">{{ item.display }}</th>
          <th v-if="backlog?.length" scope="col">{{ $t('Backlog change') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(label, index) in labels" :key="`row-${index}`">
          <th scope="row">{{ label }}</th>
          <td v-for="item in series" :key="`cell-${item.name}`">
            {{ formatNumber(item.values[index] ?? 0) }}
          </td>
          <td v-if="backlog?.length">{{ backlog[index]?.label }}</td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>
