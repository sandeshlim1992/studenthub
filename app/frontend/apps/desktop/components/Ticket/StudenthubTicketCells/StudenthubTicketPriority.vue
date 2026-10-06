<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { priorityLevelFor, STUDENTHUB_PRIORITY_STYLES } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: priority as up to three bars plus its name. The name carries the meaning,
// the bars and colour only help scanning.
interface Props {
  priority: { name: string; uiColor?: string | null }
}

const props = defineProps<Props>()

const level = computed(() => priorityLevelFor(props.priority.name, props.priority.uiColor))
const style = computed(() => STUDENTHUB_PRIORITY_STYLES[level.value])
</script>

<template>
  <span
    class="inline-flex min-w-0 items-center gap-2 text-sm font-medium group-focus-visible:text-white! group-active:text-white!"
    :style="{ color: style.color }"
    :data-level="level"
  >
    <span v-if="style.bars" class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
      <span
        v-for="bar in 3"
        :key="bar"
        class="h-3.5 w-1 rounded-sm"
        :class="bar <= style.bars ? 'bg-current' : 'bg-current opacity-20'"
      />
    </span>
    <span class="truncate">{{ $t(priority.name) }}</span>
  </span>
</template>
