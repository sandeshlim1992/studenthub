<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

// Student Hub: a waiting time as station-board flap digits ("26:00"), amber when overdue.
interface Props {
  value: string
  /** What a screen reader says instead of the digits, e.g. "Waiting 26 hours". */
  label: string
  overdue?: boolean
}

const props = defineProps<Props>()

const characters = computed(() => props.value.split(''))
</script>

<template>
  <span
    role="img"
    :aria-label="label"
    class="inline-flex shrink-0 gap-0.5 rounded bg-[#0e0f11] p-[3px]"
  >
    <span
      v-for="(character, index) in characters"
      :key="index"
      class="sh-flap sh-condensed grid h-[26px] w-[14px] place-items-center rounded-sm text-[17px] font-semibold"
      :class="overdue ? 'text-[#ffb21f]' : 'text-[#f4f1e6]'"
      aria-hidden="true"
    >
      {{ character }}
    </span>
  </span>
</template>
