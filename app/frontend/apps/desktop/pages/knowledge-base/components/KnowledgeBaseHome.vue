<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseAnswerList from './KnowledgeBaseAnswerList.vue'
import KnowledgeBaseSearch from './KnowledgeBaseSearch.vue'

// Start page of the Knowledge Base: its top categories and the answers changed last.

const { knowledgeBase, knowledgeBaseTitle, categories, answers, childrenOf, titleOf, answerCount, recentAnswers } =
  useStudenthubKnowledgeBase()

const rootCategories = computed(() => childrenOf(null))
const recent = computed(() => recentAnswers(8))
</script>

<template>
  <div class="flex flex-col gap-6">
    <header>
      <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ knowledgeBaseTitle }}</h1>
      <p class="mt-1 text-sm text-[var(--sh-muted)]">
        {{ $t('%s categories, %s answers you can see.', categories.length, answers.length) }}
        <template v-if="knowledgeBase && !knowledgeBase.active">
          {{ $t('The public help center is switched off.') }}
        </template>
      </p>
    </header>

    <KnowledgeBaseSearch />

    <section v-if="rootCategories.length" aria-labelledby="kb-home-categories" class="flex flex-col gap-3">
      <h2 id="kb-home-categories" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
        {{ $t('Categories') }}
      </h2>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="category in rootCategories" :key="category.id">
          <RouterLink
            :to="knowledgeBasePaths.category(category.id)"
            class="flex h-full items-center gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-4 hover:border-[var(--sh-app)] focus-visible:outline-2 focus-visible:outline-[var(--sh-app)]"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sh-app)] text-white">
              <CommonIcon name="book" size="small" decorative />
            </span>
            <span class="flex min-w-0 flex-col">
              <span class="truncate font-semibold text-[var(--sh-ink)]">{{ titleOf(category.titles) }}</span>
              <span class="text-xs text-[var(--sh-muted)]">{{ $t('%s answers', answerCount(category.id)) }}</span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-if="recent.length" aria-labelledby="kb-home-recent" class="flex flex-col gap-3">
      <h2 id="kb-home-recent" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
        {{ $t('Recently changed') }}
      </h2>
      <KnowledgeBaseAnswerList :answers="recent" show-category />
    </section>

    <p v-if="!rootCategories.length" class="text-sm text-[var(--sh-muted)]">
      {{ $t('There is nothing in the Knowledge Base you can see yet.') }}
    </p>
  </div>
</template>
