<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import ArticleReactionBadge from './ArticleReactionBadge.vue'

interface Props {
  subject: string
  to?: Maybe<string>
  reaction?: Maybe<string>
}

defineProps<Props>()
</script>

<template>
  <!-- Student Hub: automatic messages as a quiet line instead of a box -->
  <div class="relative px-3 py-1 text-center text-xs text-gray-100 dark:text-neutral-400">
    <CommonLabel>&quot;{{ subject }}&quot;</CommonLabel>
    <template v-if="to">
      -&gt;
      <CommonLabel>&quot;{{ to }}&quot;</CommonLabel>
    </template>

    <ArticleReactionBadge position="system" :reaction="reaction" />
  </div>
</template>
