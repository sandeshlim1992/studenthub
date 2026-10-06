<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { splitCampus, STUDENTHUB_INSTITUTION_COLORS } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: the campus field ("LSST Wembley") as an institution badge plus the place.
interface Props {
  value?: unknown
  /** Only the institution badge, with the full campus as tooltip (ticket header). */
  compact?: boolean
}

const props = defineProps<Props>()

const campus = computed(() => splitCampus(props.value))
</script>

<template>
  <span
    v-if="compact ? campus.institution : campus.institution || campus.place"
    v-tooltip="compact ? String(value) : undefined"
    class="inline-flex min-w-0 items-center gap-1.5 text-sm text-gray-100 group-hover:text-black! group-focus-visible:text-white! group-active:text-white!"
  >
    <span
      v-if="campus.institution"
      class="shrink-0 rounded-sm border-[1.5px] border-current bg-white px-1 py-px text-[10px] leading-none font-bold tracking-wide"
      :style="{ color: STUDENTHUB_INSTITUTION_COLORS[campus.institution] }"
    >
      {{ campus.institution }}
    </span>
    <span v-if="!compact" class="truncate">{{ campus.place }}</span>
  </span>
  <span v-else-if="!compact" class="text-sm text-gray-100">-</span>
</template>
