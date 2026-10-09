<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, onActivated, onMounted } from 'vue'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { useFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'
import { useStudenthubTopBarCrumbsWhileShown } from '#desktop/components/layout/StudenthubTopBar/useStudenthubTopBarCrumbs.ts'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'

import KnowledgeBaseAnswerEditor from '../components/KnowledgeBaseAnswerEditor.vue'
import KnowledgeBaseAnswerView from '../components/KnowledgeBaseAnswerView.vue'
import KnowledgeBaseCategoryView from '../components/KnowledgeBaseCategoryView.vue'
import KnowledgeBaseHome from '../components/KnowledgeBaseHome.vue'
import KnowledgeBaseLanguage from '../components/KnowledgeBaseLanguage.vue'
import KnowledgeBaseSearch from '../components/KnowledgeBaseSearch.vue'
import KnowledgeBaseSidebar from '../components/KnowledgeBaseSidebar.vue'
import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { useStudenthubKnowledgeBaseLocation } from '../composables/useStudenthubKnowledgeBaseLocation.ts'
import { KNOWLEDGE_BASE_CATEGORY_FLYOUT, knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import type { KnowledgeBaseCategory } from '../types.ts'

// Student Hub: the Knowledge Base for staff, moved from the classic UI. The categories are in the
// navigation panel (in a column of the page while the panel is hidden); the page shows the start
// page, a category, an answer or the answer editor (see routes.ts).

const { tree, isLoading, loadError, knowledgeBase, knowledgeBaseTitle, load, titleOf } =
  useStudenthubKnowledgeBase()
const { kind, id, mode, searchQuery, category, answerRow, activeCategoryId } =
  useStudenthubKnowledgeBaseLocation()

const { isSidebarCollapsed: isNavPanelHidden } = useSidebarDisplay(SidebarName.Primary)
const hasOwnColumn = computed(() => Boolean(knowledgeBase.value) && isNavPanelHidden.value)

// What the page's column offers besides the categories, above the page while the panel shows them.
const hasToolbar = computed(() => {
  const base = knowledgeBase.value
  if (!base || isNavPanelHidden.value) return false
  return base.can_create_category || base.locales.length > 1
})

onMounted(load)
// The page is kept alive; show changes made elsewhere when it comes back.
onActivated(() => {
  if (tree.value) void load()
})

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
  <div
    class="grid h-full grid-cols-1 grid-rows-1"
    :class="{ 'lg:grid-cols-[280px_1fr]': hasOwnColumn }"
  >
    <aside
      v-if="hasOwnColumn"
      class="hidden min-h-0 overflow-y-auto border-e border-[var(--sh-line)] bg-[var(--sh-panel)] px-3 py-4 lg:block"
      :aria-label="$t('Knowledge Base categories')"
    >
      <KnowledgeBaseSidebar :active-category-id="activeCategoryId" @new-category="newCategory()" />
    </aside>

    <div class="min-h-0 overflow-y-auto bg-[var(--sh-page)]">
      <div class="mx-auto flex w-full max-w-5xl flex-col gap-5 px-6 py-6">
        <div
          v-if="hasToolbar"
          class="flex flex-wrap items-end justify-end gap-3"
          data-test-id="studenthub-kb-toolbar"
        >
          <KnowledgeBaseLanguage select-id="studenthub-kb-page-language" class="w-56" />
          <CommonButton
            v-if="knowledgeBase?.can_create_category"
            variant="secondary"
            size="small"
            prefix-icon="plus"
            @click="newCategory()"
          >
            {{ $t('New category') }}
          </CommonButton>
        </div>

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
