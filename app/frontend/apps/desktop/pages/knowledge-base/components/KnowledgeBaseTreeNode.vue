<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import type { KnowledgeBaseCategory } from '../types.ts'

// One category in the Knowledge Base tree, with its sub-categories when opened.

defineOptions({ name: 'KnowledgeBaseTreeNode' })

const props = defineProps<{
  category: KnowledgeBaseCategory
  depth: number
  activeCategoryId: number | null
  expandedIds: Set<number>
}>()

const emit = defineEmits<{ toggle: [id: number] }>()

const { titleOf, childrenOf, answerCount } = useStudenthubKnowledgeBase()

const children = computed(() => childrenOf(props.category.id))
const isExpanded = computed(() => props.expandedIds.has(props.category.id))
const isActive = computed(() => props.activeCategoryId === props.category.id)
const title = computed(() => titleOf(props.category.titles))
</script>

<template>
  <li>
    <div
      class="group flex items-center gap-1 rounded-lg pe-2 text-sm"
      :class="
        isActive
          ? 'bg-[var(--sh-app-soft)] font-semibold text-[var(--sh-app)]'
          : 'text-[var(--sh-ink)] hover:bg-black/5'
      "
      :style="{ paddingInlineStart: `${depth * 0.875}rem` }"
    >
      <button
        v-if="children.length"
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded text-[var(--sh-muted)] hover:text-[var(--sh-ink)]"
        :aria-expanded="isExpanded"
        :aria-label="$t(isExpanded ? 'Close %s' : 'Open %s', title)"
        @click="emit('toggle', category.id)"
      >
        <CommonIcon :name="isExpanded ? 'chevron-down' : 'chevron-right'" size="xs" decorative />
      </button>
      <span v-else class="size-6 shrink-0" />
      <RouterLink
        :to="knowledgeBasePaths.category(category.id)"
        class="flex min-w-0 grow items-center justify-between gap-2 py-1.5 hover:no-underline! focus-visible:outline-2 focus-visible:outline-[var(--sh-app)]"
        :class="isActive ? 'text-[var(--sh-app)]!' : 'text-[var(--sh-ink)]!'"
        :aria-current="isActive ? 'page' : undefined"
      >
        <span class="truncate">{{ title }}</span>
        <span class="text-xs text-[var(--sh-muted)] tabular-nums">{{ answerCount(category.id) }}</span>
      </RouterLink>
    </div>
    <ul v-if="children.length && isExpanded" class="mt-0.5 space-y-0.5">
      <KnowledgeBaseTreeNode
        v-for="child in children"
        :key="child.id"
        :category="child"
        :depth="depth + 1"
        :active-category-id="activeCategoryId"
        :expanded-ids="expandedIds"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>
