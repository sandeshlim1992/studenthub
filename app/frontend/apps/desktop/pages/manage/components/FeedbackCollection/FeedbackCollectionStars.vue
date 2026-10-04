<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
defineProps<{ rating: number | null }>()
</script>

<template>
  <span v-if="rating" class="inline-flex items-center gap-1.5" :title="$t('%s of 5 stars', rating)">
    <span class="inline-flex" aria-hidden="true">
      <CommonIcon
        v-for="value in 5"
        :key="value"
        :name="value <= rating ? 'star-fill' : 'star'"
        class="h-3.5 w-3.5"
        :class="value <= rating ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'"
      />
    </span>
    <span class="text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-300">{{ rating }}/5</span>
  </span>
  <span v-else class="text-slate-500">–</span>
</template>
