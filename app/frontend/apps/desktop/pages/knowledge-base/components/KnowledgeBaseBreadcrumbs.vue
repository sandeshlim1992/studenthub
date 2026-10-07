<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

// Knowledge Base › category › sub-category. The last category is a link too unless it's the page.

const props = defineProps<{ categoryId: number | null; linkLast?: boolean }>()

const { knowledgeBaseTitle, ancestorsOf, titleOf } = useStudenthubKnowledgeBase()

const chain = computed(() => ancestorsOf(props.categoryId))
</script>

<template>
  <nav :aria-label="$t('Breadcrumb')" class="text-sm text-[var(--sh-muted)]">
    <ol class="flex flex-wrap items-center gap-1">
      <li>
        <RouterLink :to="knowledgeBasePaths.home()" class="text-[var(--sh-muted)] hover:text-[var(--sh-app)] hover:underline">
          {{ knowledgeBaseTitle }}
        </RouterLink>
      </li>
      <li v-for="(category, index) in chain" :key="category.id" class="flex items-center gap-1">
        <CommonIcon name="chevron-right" size="xs" decorative />
        <RouterLink
          v-if="linkLast || index < chain.length - 1"
          :to="knowledgeBasePaths.category(category.id)"
          class="text-[var(--sh-muted)] hover:text-[var(--sh-app)] hover:underline"
        >
          {{ titleOf(category.titles) }}
        </RouterLink>
        <span v-else aria-current="page" class="font-semibold text-[var(--sh-ink)]">
          {{ titleOf(category.titles) }}
        </span>
      </li>
    </ol>
  </nav>
</template>
