<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { watch } from 'vue'

import CommonSectionCollapse from '#desktop/components/CommonSectionCollapse/CommonSectionCollapse.vue'
import {
  studenthubKnowledgeBaseAnswerPath,
  studenthubKnowledgeBaseSearchPath,
  useStudenthubKnowledgeBaseAccess,
  useStudenthubKnowledgeBaseSearch,
} from '#desktop/composables/useStudenthubKnowledgeBaseSearch.ts'

// Student Hub: Knowledge Base answers in the quick search results (Zammad's GraphQL search
// covers tickets, users and organizations only).

const RESULT_LIMIT = 5

const props = defineProps<{ search: string }>()

const emit = defineEmits<{ 'update:count': [count: number]; click: [] }>()

const hasAccess = useStudenthubKnowledgeBaseAccess()

const { results } = useStudenthubKnowledgeBaseSearch(() => props.search, {
  limit: RESULT_LIMIT + 1,
  enabled: () => hasAccess.value,
})

watch(results, (found) => emit('update:count', found.length), { immediate: true })
</script>

<template>
  <CommonSectionCollapse
    v-if="results.length"
    id="studenthub-quick-search-knowledge-base"
    no-collapse
    :title="$t('Found knowledge base answers')"
  >
    <div class="flex flex-col">
      <ol class="space-y-1.5">
        <li v-for="answer in results.slice(0, RESULT_LIMIT)" :key="answer.id">
          <CommonLink
            :link="studenthubKnowledgeBaseAnswerPath(answer.id)"
            internal
            class="group/item flex grow items-center gap-2 rounded-md px-2 py-3 text-neutral-400 hover:bg-blue-900 hover:no-underline!"
            @click="emit('click')"
          >
            <CommonIcon class="shrink-0 text-neutral-500" name="book" size="tiny" decorative />
            <CommonLabel class="block! truncate group-hover/item:text-white">{{ answer.title }}</CommonLabel>
          </CommonLink>
        </li>
      </ol>
      <CommonLink
        v-if="results.length > RESULT_LIMIT"
        class="group/link my-1.5 ms-auto"
        :link="studenthubKnowledgeBaseSearchPath(search)"
        internal
        @click="emit('click')"
      >
        <CommonLabel class="text-blue-800! group-hover/link:underline" prefix-icon="search-detail" size="small">
          {{ $t('More in the Knowledge Base') }}
        </CommonLabel>
      </CommonLink>
    </div>
  </CommonSectionCollapse>
</template>
