<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { useStudenthubKnowledgeBaseSearch } from '#desktop/composables/useStudenthubKnowledgeBaseSearch.ts'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseStateBadge from './KnowledgeBaseStateBadge.vue'

// Full-text search of the answers (title and text), on the start page and as /knowledge-base?search=…

const props = defineProps<{ query?: string }>()

const router = useRouter()
const { ancestorsOf, titleOf } = useStudenthubKnowledgeBase()

const input = ref(props.query ?? '')
watch(
  () => props.query,
  (value) => {
    input.value = value ?? ''
  },
)

const submit = () => {
  const search = input.value.trim()
  router.push(search ? { path: knowledgeBasePaths.home(), query: { search } } : knowledgeBasePaths.home())
}

const { results, isLoading, error } = useStudenthubKnowledgeBaseSearch(() => props.query ?? '', { limit: 50 })

const categoryPath = (categoryId: number) =>
  ancestorsOf(categoryId)
    .map((category) => titleOf(category.titles))
    .join(' › ')
</script>

<template>
  <div class="flex flex-col gap-4">
    <form role="search" class="flex gap-2" @submit.prevent="submit">
      <label for="studenthub-kb-search" class="grow">
        <span class="sr-only">{{ $t('Search the Knowledge Base') }}</span>
        <input
          id="studenthub-kb-search"
          v-model="input"
          type="search"
          class="h-10 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
          :placeholder="$t('Search titles and text…')"
        />
      </label>
      <CommonButton type="submit" variant="primary" size="medium" prefix-icon="search" class="bg-app! text-on-app! hover:bg-app-hover!">
        {{ $t('Search') }}
      </CommonButton>
    </form>

    <section v-if="query" aria-labelledby="kb-search-results" class="flex flex-col gap-3">
      <h1 id="kb-search-results" class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
        {{ $t('Answers with “%s”', query) }}
      </h1>
      <CommonAlert v-if="error" variant="danger">{{ error }}</CommonAlert>
      <p v-else-if="isLoading && !results.length" class="text-sm text-[var(--sh-muted)]">{{ $t('Searching…') }}</p>
      <p v-else-if="!results.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No answers found.') }}</p>
      <ul v-else class="divide-y divide-[var(--sh-line)] rounded-xl border border-[var(--sh-line)] bg-white">
        <li v-for="answer in results" :key="answer.id">
          <RouterLink
            :to="knowledgeBasePaths.answer(answer.id)"
            class="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--sh-app-soft)] hover:no-underline! focus-visible:outline-2 focus-visible:outline-[var(--sh-app)]"
          >
            <span class="flex items-center gap-2">
              <span class="grow truncate font-semibold text-[var(--sh-ink)]">{{ answer.title }}</span>
              <KnowledgeBaseStateBadge :state="answer.state" />
            </span>
            <span class="truncate text-xs text-[var(--sh-muted)]">{{ categoryPath(answer.category_id) }}</span>
            <span class="line-clamp-2 text-sm text-[var(--sh-ink-2)]">{{ answer.snippet }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>
  </div>
</template>
