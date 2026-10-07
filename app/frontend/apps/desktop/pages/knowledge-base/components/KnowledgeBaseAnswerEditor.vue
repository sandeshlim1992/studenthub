<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import type { TreeSelectOption } from '#shared/components/Form/fields/FieldTreeSelect/types.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { defineFormSchema } from '#shared/form/defineFormSchema.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import { knowledgeBaseImageCids, prepareKnowledgeBaseBody } from '../utils/knowledgeBaseBody.ts'
import { knowledgeBasePaths } from '../utils/knowledgeBasePaths.ts'

import KnowledgeBaseBreadcrumbs from './KnowledgeBaseBreadcrumbs.vue'

import type { KnowledgeBaseAnswerDetail } from '../types.ts'

// Writing a new answer or editing one, in the language chosen in the side panel. New answers start
// as drafts; publishing is on the answer's page.

const props = defineProps<{ answerId?: number; categoryId?: number }>()

interface AnswerFormData {
  title: string
  category_id: number
  body: string
}

const router = useRouter()
const { notify } = useNotifications()
const { form, isDisabled } = useForm()
const { localeId, knowledgeBase, childrenOf, titleOf, loadAnswer, saveAnswer } = useStudenthubKnowledgeBase()

const answer = ref<KnowledgeBaseAnswerDetail | null>(null)
const loadError = ref<string | null>(null)
const isLoaded = ref(!props.answerId)

watch(
  () => props.answerId,
  async (id) => {
    if (!id) return

    isLoaded.value = false
    try {
      answer.value = await loadAnswer(id)
      loadError.value = null
    } catch (error) {
      loadError.value = (error as Error).message
    } finally {
      isLoaded.value = true
    }
  },
  { immediate: true },
)

const translation = computed(() => answer.value?.translations.find((item) => item.kb_locale_id === localeId.value))
const imageCids = computed(() => knowledgeBaseImageCids(translation.value?.body ?? ''))
const languageName = computed(() => knowledgeBase.value?.locales.find((locale) => locale.id === localeId.value)?.name)
const hasManyLanguages = computed(() => (knowledgeBase.value?.locales.length ?? 0) > 1)

// Every category the user can see; only those they may edit can be chosen.
const categoryOptions = (parentId: number | null): TreeSelectOption[] =>
  childrenOf(parentId).map((category) => {
    const children = categoryOptions(category.id)
    return {
      value: category.id,
      label: titleOf(category.titles),
      disabled: !category.editable,
      ...(children.length ? { children } : {}),
    }
  })

const schema = defineFormSchema([
  {
    type: 'text',
    name: 'title',
    label: __('Title'),
    required: true,
    props: { maxLength: 250 },
  },
  {
    type: 'treeselect',
    name: 'category_id',
    label: __('Category'),
    required: true,
    props: { options: categoryOptions(null) },
  },
  {
    type: 'editor',
    name: 'body',
    label: __('Text'),
    required: true,
  },
])

const initialValues = computed(() => ({
  title: translation.value?.title ?? '',
  category_id: answer.value?.category_id ?? props.categoryId,
  body: translation.value?.body ?? '',
}))

const backTo = computed(() => {
  if (props.answerId) return knowledgeBasePaths.answer(props.answerId)
  if (props.categoryId) return knowledgeBasePaths.category(props.categoryId)
  return knowledgeBasePaths.home()
})

const submit = async (data: FormSubmitData<AnswerFormData>) => {
  try {
    const id = await saveAnswer({
      id: props.answerId,
      categoryId: Number(data.category_id),
      translationId: translation.value?.id,
      title: data.title,
      body: await prepareKnowledgeBaseBody(data.body, imageCids.value),
    })
    notify({ id: 'kb-answer-saved', type: NotificationTypes.Success, message: __('The answer has been saved.') })
    await router.push(knowledgeBasePaths.answer(id))
  } catch (error) {
    notify({ id: 'kb-answer-error', type: NotificationTypes.Error, message: (error as Error).message })
  }
}
</script>

<template>
  <CommonAlert v-if="loadError" variant="danger">{{ loadError }}</CommonAlert>

  <div v-else-if="isLoaded" class="flex flex-col gap-5">
    <header class="flex flex-col gap-2">
      <KnowledgeBaseBreadcrumbs :category-id="answer?.category_id ?? categoryId ?? null" link-last />
      <h1 class="text-2xl font-bold tracking-tight text-[var(--sh-ink)]">
        {{ answerId ? $t('Edit answer') : $t('New answer') }}
      </h1>
      <p v-if="hasManyLanguages" class="text-sm text-[var(--sh-muted)]">
        {{ $t('Language: %s', languageName) }}
      </p>
      <p v-if="!answerId" class="text-sm text-[var(--sh-muted)]">
        {{ $t('New answers are drafts until you make them internal or publish them.') }}
      </p>
    </header>

    <div class="rounded-xl border border-[var(--sh-line)] bg-white p-5">
      <Form
        id="studenthub-kb-answer"
        ref="form"
        :schema="schema"
        :initial-values="initialValues"
        should-autofocus
        @submit="submit($event as FormSubmitData<AnswerFormData>)"
      >
        <template #after-fields>
          <div class="mt-5 flex items-center justify-end gap-2">
            <CommonButton variant="secondary" size="medium" @click="router.push(backTo)">
              {{ $t('Cancel') }}
            </CommonButton>
            <CommonButton variant="primary" type="submit" size="medium" class="bg-app! text-on-app! hover:bg-app-hover!" :disabled="isDisabled">
              {{ $t('Save') }}
            </CommonButton>
          </div>
        </template>
      </Form>
    </div>
  </div>

  <p v-else class="text-sm text-[var(--sh-muted)]">{{ $t('Loading…') }}</p>
</template>
