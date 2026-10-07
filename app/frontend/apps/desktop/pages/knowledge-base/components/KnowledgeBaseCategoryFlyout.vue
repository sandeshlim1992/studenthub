<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { NotificationTypes, useNotifications } from '#shared/components/CommonNotifications/index.ts'
import type { TreeSelectOption } from '#shared/components/Form/fields/FieldTreeSelect/types.ts'
import Form from '#shared/components/Form/Form.vue'
import type { FormSubmitData } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { defineFormSchema } from '#shared/form/defineFormSchema.ts'
import { i18n } from '#shared/i18n/index.ts'

import CommonFlyout from '#desktop/components/CommonFlyout/CommonFlyout.vue'
import type { ActionFooterOptions } from '#desktop/components/CommonFlyout/types.ts'
import { closeFlyout } from '#desktop/components/CommonFlyout/useFlyout.ts'

import { useStudenthubKnowledgeBase } from '../composables/useStudenthubKnowledgeBase.ts'
import {
  KNOWLEDGE_BASE_CATEGORY_FLYOUT,
  knowledgeBaseCategoryIcons,
  knowledgeBasePaths,
} from '../utils/knowledgeBasePaths.ts'

// New category or editing one: title (in the chosen language), where it sits, and the icon the
// public help center shows.

const props = defineProps<{ categoryId?: number; parentId?: number | null }>()

interface CategoryFormData {
  title: string
  parent_id: number | null
  icon: string
}

const router = useRouter()
const { notify } = useNotifications()
const { form } = useForm()
const { knowledgeBase, categoryById, childrenOf, titleOf, saveCategory } = useStudenthubKnowledgeBase()

const category = computed(() => categoryById(props.categoryId))

// A category can't move under itself or its own sub-categories.
const parentOptions = (parentId: number | null): TreeSelectOption[] =>
  childrenOf(parentId)
    .filter((item) => item.id !== props.categoryId)
    .map((item) => {
      const children = parentOptions(item.id)
      return {
        value: item.id,
        label: titleOf(item.titles),
        disabled: !item.editable,
        ...(children.length ? { children } : {}),
      }
    })

const iconOptions = computed(() => {
  const options = knowledgeBaseCategoryIcons.map((icon) => ({ value: icon.value, label: icon.label }))
  const current = category.value?.icon
  if (current && !options.some((option) => option.value === current)) {
    options.unshift({ value: current, label: i18n.t('Current icon (%s)', current) })
  }
  return options
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
    name: 'parent_id',
    label: __('Inside'),
    props: {
      options: parentOptions(null),
      clearable: true,
      placeholder: __('Top level'),
    },
    required: !knowledgeBase.value?.can_create_category,
  },
  {
    type: 'select',
    name: 'icon',
    label: __('Icon in the help center'),
    required: true,
    props: { options: iconOptions.value },
  },
])

const initialValues = computed(() => ({
  title: category.value ? titleOf(category.value.titles) : '',
  parent_id: category.value ? category.value.parent_id : (props.parentId ?? null),
  icon: category.value?.icon ?? knowledgeBaseCategoryIcons[0].value,
}))

const submit = async (data: FormSubmitData<CategoryFormData>) => {
  try {
    const id = await saveCategory({
      id: props.categoryId,
      parentId: data.parent_id ? Number(data.parent_id) : null,
      icon: data.icon,
      title: data.title,
    })
    notify({ id: 'kb-category-saved', type: NotificationTypes.Success, message: __('The category has been saved.') })

    return () => {
      closeFlyout(KNOWLEDGE_BASE_CATEGORY_FLYOUT)
      router.push(knowledgeBasePaths.category(id))
    }
  } catch (error) {
    notify({ id: 'kb-category-error', type: NotificationTypes.Error, message: (error as Error).message })
  }
}

const footerActionOptions = computed<ActionFooterOptions>(() => ({
  actionButton: { variant: 'submit', type: 'submit' },
  actionLabel: __('Save'),
}))
</script>

<template>
  <CommonFlyout
    :header-title="categoryId ? __('Edit category') : __('New category')"
    header-icon="book"
    no-close-on-action
    :form="form"
    :footer-action-options="footerActionOptions"
    :name="KNOWLEDGE_BASE_CATEGORY_FLYOUT"
  >
    <Form
      ref="form"
      :schema="schema"
      :initial-values="initialValues"
      should-autofocus
      @submit="submit($event as FormSubmitData<CategoryFormData>)"
    />
  </CommonFlyout>
</template>
