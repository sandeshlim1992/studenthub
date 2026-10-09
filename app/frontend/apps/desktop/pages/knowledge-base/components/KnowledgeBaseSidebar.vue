<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseCategoryTree from './KnowledgeBaseCategoryTree.vue'
import KnowledgeBaseLanguage from './KnowledgeBaseLanguage.vue'

// Left column of the Knowledge Base page while the navigation panel is hidden: language, the
// category tree and a quick filter by title.

defineProps<{ activeCategoryId: number | null }>()

const emit = defineEmits<{ 'new-category': [] }>()

const { knowledgeBase, knowledgeBaseTitle } = useStudenthubKnowledgeBase()
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex flex-col items-start gap-2 ps-1">
      <RouterLink
        :to="knowledgeBasePaths.home()"
        class="text-sm font-extrabold tracking-wide text-slate-800 uppercase hover:text-[var(--sh-app)]"
      >
        {{ knowledgeBaseTitle }}
      </RouterLink>
      <CommonButton
        v-if="knowledgeBase?.can_create_category"
        variant="secondary"
        size="small"
        prefix-icon="plus"
        @click="emit('new-category')"
      >
        {{ $t('New category') }}
      </CommonButton>
    </div>

    <KnowledgeBaseLanguage select-id="studenthub-kb-language" class="ps-1" />

    <KnowledgeBaseCategoryTree
      :active-category-id="activeCategoryId"
      filter-id="studenthub-kb-filter"
    />
  </div>
</template>
