<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import KnowledgeBaseCategoryTree from '#desktop/pages/knowledge-base/components/KnowledgeBaseCategoryTree.vue'
import { useStudenthubKnowledgeBase } from '#desktop/pages/knowledge-base/composables/useStudenthubKnowledgeBase.ts'
import { useStudenthubKnowledgeBaseLocation } from '#desktop/pages/knowledge-base/composables/useStudenthubKnowledgeBaseLocation.ts'

// Student Hub: the navigation panel on the Knowledge Base page: a filter by title and the category
// tree, with the category shown marked (the page's own column while the panel is hidden). The page
// loads the Knowledge Base.

const { tree, knowledgeBase } = useStudenthubKnowledgeBase()
const { activeCategoryId } = useStudenthubKnowledgeBaseLocation()
</script>

<template>
  <div>
    <KnowledgeBaseCategoryTree
      v-if="knowledgeBase"
      :active-category-id="activeCategoryId"
      filter-id="studenthub-nav-kb-filter"
    />
    <p v-else-if="!tree" class="sh-nav-panel__empty">{{ $t('Loading…') }}</p>
  </div>
</template>
