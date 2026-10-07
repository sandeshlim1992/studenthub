<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import { useConfirmation } from '#shared/composables/useConfirmation.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseAnswerList from './KnowledgeBaseAnswerList.vue'
import KnowledgeBaseBreadcrumbs from './KnowledgeBaseBreadcrumbs.vue'

import type { KnowledgeBaseCategory } from '../types.ts'

const props = defineProps<{ category: KnowledgeBaseCategory }>()

const emit = defineEmits<{
  'edit-category': [category: KnowledgeBaseCategory]
  'new-category': [parentId: number]
}>()

const router = useRouter()
const { notify } = useNotifications()
const { waitForVariantConfirmation } = useConfirmation()
const { titleOf, childrenOf, answersOf, answerCount, deleteCategory } = useStudenthubKnowledgeBase()

const subcategories = computed(() => childrenOf(props.category.id))
const categoryAnswers = computed(() => answersOf(props.category.id))
const isEmpty = computed(() => !subcategories.value.length && !categoryAnswers.value.length)

const remove = async () => {
  if (!(await waitForVariantConfirmation('delete'))) return

  try {
    const parentId = props.category.parent_id
    await deleteCategory(props.category.id)
    notify({ id: 'kb-category-deleted', type: NotificationTypes.Success, message: __('Category deleted.') })
    await router.push(parentId ? knowledgeBasePaths.category(parentId) : knowledgeBasePaths.home())
  } catch (error) {
    notify({ id: 'kb-category-error', type: NotificationTypes.Error, message: (error as Error).message })
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <header class="flex flex-col gap-2">
      <KnowledgeBaseBreadcrumbs :category-id="category.id" />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">{{ titleOf(category.titles) }}</h1>
        <div v-if="category.editable" class="flex flex-wrap gap-2">
          <CommonButton
            variant="primary"
            size="medium"
            prefix-icon="plus"
            class="bg-app! text-on-app! hover:bg-app-hover!"
            @click="router.push(knowledgeBasePaths.newAnswer(category.id))"
          >
            {{ $t('New answer') }}
          </CommonButton>
          <CommonButton variant="secondary" size="medium" prefix-icon="plus" @click="emit('new-category', category.id)">
            {{ $t('New sub-category') }}
          </CommonButton>
          <CommonButton variant="secondary" size="medium" prefix-icon="pencil" @click="emit('edit-category', category)">
            {{ $t('Edit') }}
          </CommonButton>
          <CommonButton
            v-if="isEmpty"
            variant="danger"
            size="medium"
            prefix-icon="trash3"
            @click="remove"
          >
            {{ $t('Delete') }}
          </CommonButton>
        </div>
      </div>
    </header>

    <section v-if="subcategories.length" aria-labelledby="kb-subcategories" class="flex flex-col gap-3">
      <h2 id="kb-subcategories" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
        {{ $t('Sub-categories') }}
      </h2>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <li v-for="child in subcategories" :key="child.id">
          <RouterLink
            :to="knowledgeBasePaths.category(child.id)"
            class="flex h-full flex-col rounded-xl border border-[var(--sh-line)] bg-white p-4 hover:border-[var(--sh-app)]"
          >
            <span class="truncate font-semibold text-[var(--sh-ink)]">{{ titleOf(child.titles) }}</span>
            <span class="text-xs text-[var(--sh-muted)]">{{ $t('%s answers', answerCount(child.id)) }}</span>
          </RouterLink>
        </li>
      </ul>
    </section>

    <section aria-labelledby="kb-answers" class="flex flex-col gap-3">
      <h2 id="kb-answers" class="text-sm font-extrabold tracking-wider text-slate-600 uppercase">
        {{ $t('Answers') }}
      </h2>
      <KnowledgeBaseAnswerList v-if="categoryAnswers.length" :answers="categoryAnswers" />
      <p v-else class="text-sm text-[var(--sh-muted)]">{{ $t('No answers in this category.') }}</p>
    </section>
  </div>
</template>
