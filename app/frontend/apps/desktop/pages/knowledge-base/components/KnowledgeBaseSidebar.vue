<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseStateBadge from './KnowledgeBaseStateBadge.vue'
import KnowledgeBaseTreeNode from './KnowledgeBaseTreeNode.vue'

// Left panel of the Knowledge Base page: language, the category tree and a quick filter by title.

const props = defineProps<{ activeCategoryId: number | null }>()

const emit = defineEmits<{ 'new-category': [] }>()

const {
  knowledgeBase,
  knowledgeBaseTitle,
  localeId,
  categories,
  answers,
  titleOf,
  childrenOf,
  ancestorsOf,
} = useStudenthubKnowledgeBase()

const expandedIds = reactive(new Set<number>())

const toggle = (id: number) => {
  if (expandedIds.has(id)) expandedIds.delete(id)
  else expandedIds.add(id)
}

// Open the way to the category being shown.
watch(
  () => props.activeCategoryId,
  (id) => {
    ancestorsOf(id).forEach((category) => expandedIds.add(category.id))
  },
  { immediate: true },
)

const filter = ref('')
const term = computed(() => filter.value.trim().toLowerCase())

const matchingCategories = computed(() =>
  term.value ? categories.value.filter((category) => titleOf(category.titles).toLowerCase().includes(term.value)) : [],
)
const matchingAnswers = computed(() =>
  term.value
    ? answers.value.filter((answer) => titleOf(answer.titles).toLowerCase().includes(term.value)).slice(0, 50)
    : [],
)
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

    <label
      v-if="(knowledgeBase?.locales.length ?? 0) > 1"
      for="studenthub-kb-language"
      class="flex flex-col gap-1 ps-1 text-xs text-[var(--sh-muted)]"
    >
      {{ $t('Language') }}
      <select
        id="studenthub-kb-language"
        v-model.number="localeId"
        class="h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)]"
      >
        <option v-for="locale in knowledgeBase?.locales" :key="locale.id" :value="locale.id">
          {{ locale.name }}
        </option>
      </select>
    </label>

    <label for="studenthub-kb-filter" class="block">
      <span class="sr-only">{{ $t('Filter by title') }}</span>
      <input
        id="studenthub-kb-filter"
        v-model="filter"
        type="search"
        class="h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
        :placeholder="$t('Filter by title…')"
      />
    </label>

    <nav v-if="term" :aria-label="$t('Matching titles')" class="flex flex-col gap-1 text-sm">
      <p v-if="!matchingCategories.length && !matchingAnswers.length" class="px-2 py-1 text-[var(--sh-muted)]">
        {{ $t('No matching titles.') }}
      </p>
      <RouterLink
        v-for="category in matchingCategories"
        :key="`category-${category.id}`"
        :to="knowledgeBasePaths.category(category.id)"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 font-semibold text-[var(--sh-ink)]! hover:bg-black/5 hover:no-underline!"
      >
        <CommonIcon name="files" size="xs" class="shrink-0 text-[var(--sh-muted)]" decorative />
        <span class="truncate">{{ titleOf(category.titles) }}</span>
      </RouterLink>
      <RouterLink
        v-for="answer in matchingAnswers"
        :key="`answer-${answer.id}`"
        :to="knowledgeBasePaths.answer(answer.id)"
        class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[var(--sh-ink)]! hover:bg-black/5 hover:no-underline!"
      >
        <CommonIcon name="file-text" size="xs" class="shrink-0 text-[var(--sh-muted)]" decorative />
        <span class="grow truncate">{{ titleOf(answer.titles) }}</span>
        <KnowledgeBaseStateBadge v-if="answer.state !== 'published'" :state="answer.state" />
      </RouterLink>
    </nav>

    <nav v-else :aria-label="$t('Categories')">
      <p v-if="!categories.length" class="px-2 py-1 text-sm text-[var(--sh-muted)]">
        {{ $t('No categories yet.') }}
      </p>
      <ul class="space-y-0.5">
        <KnowledgeBaseTreeNode
          v-for="category in childrenOf(null)"
          :key="category.id"
          :category="category"
          :depth="0"
          :active-category-id="activeCategoryId"
          :expanded-ids="expandedIds"
          @toggle="toggle"
        />
      </ul>
    </nav>
  </div>
</template>
