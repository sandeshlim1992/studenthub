<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'

import KnowledgeBaseAnswerEditor from '../components/KnowledgeBaseAnswerEditor.vue'
import KnowledgeBaseAnswerView from '../components/KnowledgeBaseAnswerView.vue'
import KnowledgeBaseCategoryView from '../components/KnowledgeBaseCategoryView.vue'
import KnowledgeBaseHome from '../components/KnowledgeBaseHome.vue'
import KnowledgeBaseSearch from '../components/KnowledgeBaseSearch.vue'
import KnowledgeBaseSidebar from '../components/KnowledgeBaseSidebar.vue'
import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { KNOWLEDGE_BASE_CATEGORY_FLYOUT, knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import type { KnowledgeBaseCategory } from '../types.ts'

// Student Hub: the Knowledge Base for staff, moved from the classic UI. Categories on the left,
// the start page, a category, an answer or the answer editor on the right (see routes.ts).

const route = useRoute()
const { tree, isLoading, loadError, knowledgeBase, knowledgeBaseTitle, load, categoryById, answerById, titleOf } =
  useStudenthubKnowledgeBase()

onMounted(load)
// The page is kept alive; show changes made elsewhere when it comes back.
onActivated(() => {
  if (tree.value) void load()
})

const kind = computed(() => (route.params.kind as string | undefined) || null)
const id = computed(() => (route.params.id ? Number(route.params.id) : null))
const mode = computed(() => (route.params.mode as string | undefined) || null)
const searchQuery = computed(() => (typeof route.query.search === 'string' ? route.query.search.trim() : ''))

const category = computed(() => (kind.value === 'category' ? categoryById(id.value) : undefined))
const answerRow = computed(() => (kind.value === 'answer' ? answerById(id.value) : undefined))

const activeCategoryId = computed(() => category.value?.id ?? answerRow.value?.category_id ?? null)

useStudenthubTopBarCrumbsWhileShown(
  computed(() => {
    const crumbs: { label: string; route?: string }[] = [
      { label: knowledgeBaseTitle.value, route: knowledgeBasePaths.home() },
    ]
    if (category.value) crumbs.push({ label: titleOf(category.value.titles) })
    if (answerRow.value) crumbs.push({ label: titleOf(answerRow.value.titles) })
    if (kind.value === 'category' && mode.value === 'new') crumbs.push({ label: __('New answer') })
    if (!kind.value && searchQuery.value) crumbs.push({ label: __('Search') })
    return crumbs
  }),
)

const categoryFlyout = useFlyout({
  name: KNOWLEDGE_BASE_CATEGORY_FLYOUT,
  component: () => import('../components/KnowledgeBaseCategoryFlyout.vue'),
})

const newCategory = (parentId: number | null = null) => categoryFlyout.open({ parentId })
const editCategory = (item: KnowledgeBaseCategory) => categoryFlyout.open({ categoryId: item.id })
</script>

<template>
  <div class="grid h-full grid-cols-1 grid-rows-1 lg:grid-cols-[280px_1fr]">
    <aside
      v-if="knowledgeBase"
      class="hidden min-h-0 overflow-y-auto border-e border-[var(--sh-line)] bg-[var(--sh-panel)] px-3 py-4 lg:block"
      :aria-label="$t('Knowledge Base categories')"
    >
      <KnowledgeBaseSidebar :active-category-id="activeCategoryId" @new-category="newCategory()" />
    </aside>

    <div class="min-h-0 overflow-y-auto bg-[var(--sh-page)]" :class="{ 'lg:col-span-2': !knowledgeBase }">
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
        <CommonAlert v-if="loadError" variant="danger">
          {{ $t('The Knowledge Base could not be loaded: %s', loadError) }}
        </CommonAlert>

        <p v-else-if="!tree && isLoading" class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>

        <div v-else-if="tree && !knowledgeBase" class="rounded-xl border border-[var(--sh-line)] bg-white p-6">
          <h1 class="text-xl font-bold text-[var(--sh-ink)]">{{ $t('Knowledge Base') }}</h1>
          <p class="mt-2 text-sm text-[var(--sh-muted)]">
            {{ $t('There is no Knowledge Base yet. Admins set it up under Administration → Knowledge Base.') }}
          </p>
        </div>

        <template v-else-if="tree">
          <KnowledgeBaseAnswerEditor
            v-if="kind === 'answer' && mode === 'edit' && id"
            :key="`edit-${id}`"
            :answer-id="id"
          />
          <KnowledgeBaseAnswerEditor
            v-else-if="kind === 'category' && mode === 'new' && id"
            :key="`new-${id}`"
            :category-id="id"
          />
          <KnowledgeBaseAnswerView v-else-if="kind === 'answer' && id" :answer-id="id" />
          <KnowledgeBaseCategoryView
            v-else-if="category"
            :category="category"
            @new-category="newCategory"
            @edit-category="editCategory"
          />
          <CommonAlert v-else-if="kind === 'category'" variant="warning">
            {{ $t("This category doesn't exist, or you can't see it.") }}
          </CommonAlert>
          <KnowledgeBaseSearch v-else-if="searchQuery" :query="searchQuery" />
          <KnowledgeBaseHome v-else />
        </template>
      </div>
    </div>
  </div>
</template>
