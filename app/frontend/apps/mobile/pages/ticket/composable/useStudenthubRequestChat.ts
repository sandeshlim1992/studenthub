// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed, reactive, ref, watch } from 'vue'

import { useObjectAttributes } from '#shared/entities/object-attributes/composables/useObjectAttributes.ts'
import type { ObjectAttribute } from '#shared/entities/object-attributes/types/store.ts'
import { EnumObjectManagerObjects } from '#shared/graphql/types.ts'
import { i18n } from '#shared/i18n.ts'
import {
  requestFormItems,
  type StudenthubRequestFormDefinition,
  type StudenthubRequestFormQuestion,
} from '#shared/types/studenthubRequestForm.ts'
import { studenthubApi } from '#shared/utils/studenthubApi.ts'

import {
  studenthubSubCategoryMatches,
  type RequestCategories,
  type RequestChoice,
  type RequestSearchMatch,
} from '#mobile/entities/ticket/helpers/studenthubSubCategoryMatches.ts'

// Student Hub: the conversation of the mobile app's New request (design B, with E's search). The
// student answers one step at a time: what it is about (a category, or a sub-category found by
// typing), the sub-category, the campus, then either the questions of the admins' request form for
// that sub-category or what happened. The choices are the new UI wizard's
// (/api/v1/studenthub/ticket_wizard_metadata), as is the request form.

export interface RequestChatMetadata extends RequestCategories {
  campuses: RequestChoice[]
}

export type RequestChatInput =
  | 'choice'
  | 'multi'
  | 'text'
  | 'longtext'
  | 'date'
  | 'datetime'
  | 'number'

export interface RequestChatOption {
  label: string
  value: unknown
  // Campuses are grouped by their college (the first word of their name).
  group?: string
}

export interface RequestChatStep {
  id: string
  // Headings and notes of a request form, said before the step's question.
  intro: string[]
  prompt: string
  help?: string
  input: RequestChatInput
  options: RequestChatOption[]
  required: boolean
}

export interface RequestChatAnswer {
  value: unknown
  text: string
  // A sub-category found by typing answers the category step as well; only that one shows.
  hidden?: boolean
}

export interface RequestChatMessage {
  id: string
  from: 'hub' | 'student'
  text: string
  // The step a student's answer belongs to, so it can be changed.
  stepId?: string
}

const DESCRIPTION_MIN_LENGTH = 10
const MAX_MATCHES = 8

const QUESTION_INPUT: Record<StudenthubRequestFormQuestion['kind'], RequestChatInput> = {
  text: 'text',
  textarea: 'longtext',
  select: 'choice',
  multiselect: 'multi',
  date: 'date',
  datetime: 'datetime',
  boolean: 'choice',
  integer: 'number',
}

const FIELD_INPUT: Record<string, RequestChatInput> = {
  select: 'choice',
  tree_select: 'choice',
  boolean: 'choice',
  multiselect: 'multi',
  multi_tree_select: 'multi',
  date: 'date',
  datetime: 'datetime',
  integer: 'number',
  textarea: 'longtext',
  richtext: 'longtext',
}

const yesNo = (): RequestChatOption[] => [
  { label: i18n.t('Yes'), value: true },
  { label: i18n.t('No'), value: false },
]

interface TreeOption {
  name?: string
  value?: string
  children?: TreeOption[]
}

// Zammad's tree fields name an option by its path ("Parent::Child").
const flattenTree = (options: TreeOption[], parents: string[] = []): RequestChatOption[] =>
  options.flatMap((option) => {
    const path = [...parents, option.value ?? option.name ?? '']
    const own = { label: path.join(' › '), value: path.join('::') }
    return option.children?.length ? [own, ...flattenTree(option.children, path)] : [own]
  })

const fieldOptions = (attribute: ObjectAttribute): RequestChatOption[] => {
  if (attribute.dataType === 'boolean') return yesNo()

  const options = attribute.dataOption?.options
  const translate = (label: string) => (attribute.dataOption?.translate ? i18n.t(label) : label)
  if (Array.isArray(options)) {
    return flattenTree(options as TreeOption[]).map((option) => ({
      ...option,
      label: translate(option.label),
    }))
  }
  if (!options || typeof options !== 'object') return []

  return Object.entries(options as Record<string, string>).map(([value, label]) => ({
    label: translate(label),
    value,
  }))
}

export const isAnswerValid = (step: RequestChatStep, value: unknown) => {
  if (value === null || value === undefined) return !step.required
  if (step.id === 'description') return String(value).trim().length >= DESCRIPTION_MIN_LENGTH
  if (step.input === 'number') return /^-?\d+$/.test(String(value).trim())
  if (Array.isArray(value)) return value.length > 0 || !step.required
  if (typeof value === 'string') return value.trim().length > 0 || !step.required
  return true
}

export const useStudenthubRequestChat = (firstName: () => string | undefined) => {
  const metadata = ref<RequestChatMetadata | null>(null)
  const loadError = ref(false)
  const requestForm = ref<StudenthubRequestFormDefinition | null>(null)
  const isFormLoading = ref(false)
  const answers = reactive(new Map<string, RequestChatAnswer>())

  const { attributesLookup } = useObjectAttributes(EnumObjectManagerObjects.Ticket)

  const load = async () => {
    try {
      metadata.value = await studenthubApi<RequestChatMetadata>(
        '/api/v1/studenthub/ticket_wizard_metadata',
      )
    } catch {
      loadError.value = true
    }
  }

  const valueOf = (stepId: string) => answers.get(stepId)?.value as string | undefined

  const category = computed(() =>
    metadata.value?.categories.find((choice) => choice.value === valueOf('category')),
  )

  const subCategories = computed(
    () => (category.value && metadata.value?.subcategories_by_category[category.value.value]) || [],
  )

  // The form for the chosen category and sub-category, as on the new UI's wizard.
  watch(
    () => [valueOf('category'), valueOf('subCategory')] as const,
    async ([categoryValue, subCategoryValue]) => {
      requestForm.value = null
      if (!categoryValue || !subCategoryValue) return

      isFormLoading.value = true
      const query = new URLSearchParams({ category: categoryValue, sub_category: subCategoryValue })
      try {
        const form = await studenthubApi<StudenthubRequestFormDefinition | null>(
          `/api/v1/studenthub/request_forms/applicable?${query}`,
        )
        if (valueOf('category') === categoryValue && valueOf('subCategory') === subCategoryValue) {
          requestForm.value = form
        }
      } catch {
        requestForm.value = null
      } finally {
        isFormLoading.value = false
      }
    },
  )

  const formSteps = (form: StudenthubRequestFormDefinition) => {
    const steps: RequestChatStep[] = []
    let intro: string[] = []

    requestFormItems(form).forEach((item) => {
      if (item.type === 'heading') intro.push(item.text)
      if (item.type === 'note') intro.push(item.text)
      if (item.type === 'question') {
        steps.push({
          id: `question:${item.key}`,
          intro,
          prompt: item.label,
          help: item.help || undefined,
          input: QUESTION_INPUT[item.kind],
          options:
            item.kind === 'boolean'
              ? yesNo()
              : (item.options ?? []).map((option) => ({ label: option, value: option })),
          required: item.required,
        })
        intro = []
      }
      if (item.type === 'field') {
        const attribute = attributesLookup.value.get(item.name)
        if (!attribute) return

        steps.push({
          id: `field:${item.name}`,
          intro,
          prompt: i18n.t(attribute.display),
          input: FIELD_INPUT[attribute.dataType] ?? 'text',
          options: fieldOptions(attribute),
          required: item.required,
        })
        intro = []
      }
    })

    return steps
  }

  const steps = computed<RequestChatStep[]>(() => {
    if (!metadata.value) return []

    const name = firstName()
    const list: RequestChatStep[] = [
      {
        id: 'category',
        intro: [],
        prompt: name
          ? i18n.t('Hi %s. What do you need help with? Type a few words or pick a category.', name)
          : i18n.t('What do you need help with? Type a few words or pick a category.'),
        input: 'choice',
        options: metadata.value.categories.map((choice) => ({
          label: choice.name,
          value: choice.value,
        })),
        required: true,
      },
      {
        id: 'subCategory',
        intro: [],
        prompt: i18n.t('Which of these is it?'),
        input: 'choice',
        options: subCategories.value.map((choice) => ({ label: choice.name, value: choice.value })),
        required: true,
      },
      {
        id: 'campus',
        intro: [],
        prompt: i18n.t('Which campus are you at?'),
        input: 'choice',
        options: metadata.value.campuses.map((choice) => ({
          label: choice.name,
          value: choice.value,
          group: choice.name.split(' ')[0],
        })),
        required: true,
      },
    ]
    if (isFormLoading.value) return list
    if (requestForm.value) return [...list, ...formSteps(requestForm.value)]

    return [
      ...list,
      {
        id: 'description',
        intro: [],
        prompt: i18n.t(
          'Tell us what happened. A sentence or two is enough, and you can add photos.',
        ),
        input: 'longtext',
        options: [],
        required: true,
      },
    ]
  })

  const currentStep = computed(() => steps.value.find((step) => !answers.has(step.id)))

  // The campus is answered while the request form is still on its way.
  const isWaiting = computed(() => answers.has('campus') && isFormLoading.value)
  const isComplete = computed(
    () => Boolean(metadata.value) && !isWaiting.value && !currentStep.value,
  )

  const messages = computed(() => {
    const list: RequestChatMessage[] = []

    for (const step of steps.value) {
      const answer = answers.get(step.id)
      if (answer?.hidden) continue

      step.intro.forEach((text, index) =>
        list.push({ id: `${step.id}:intro:${index}`, from: 'hub', text }),
      )
      list.push({
        id: `${step.id}:prompt`,
        from: 'hub',
        text: step.help ? `${step.prompt}\n${step.help}` : step.prompt,
      })
      if (!answer) break

      list.push({ id: `${step.id}:answer`, from: 'student', text: answer.text, stepId: step.id })
    }

    return list
  })

  const answer = (stepId: string, value: unknown, text: string) => {
    answers.set(stepId, { value, text })
  }

  const skip = (stepId: string) => {
    answers.set(stepId, { value: null, text: i18n.t('Skipped') })
  }

  const pickMatch = (match: RequestSearchMatch) => {
    answers.set('category', { value: match.category.value, text: match.subCategory.name })
    answers.set('subCategory', {
      value: match.subCategory.value,
      text: match.subCategory.name,
      hidden: true,
    })
  }

  // Changing an answer asks again from that step on.
  const change = (stepId: string) => {
    const index = steps.value.findIndex((step) => step.id === stepId)
    steps.value.slice(index).forEach((step) => answers.delete(step.id))
  }

  const searchMatches = (query: string, inCategory?: string): RequestSearchMatch[] => {
    if (!metadata.value) return []

    return studenthubSubCategoryMatches(metadata.value, query, { inCategory, limit: MAX_MATCHES })
  }

  // What the ticket is made of, once every step is answered.
  const request = computed(() => {
    const subCategoryValue = valueOf('subCategory') ?? ''
    const subCategoryName = answers.get('subCategory')?.text ?? subCategoryValue
    const campus = valueOf('campus') ?? ''
    const categoryName = category.value?.name ?? ''
    const fields: Record<string, unknown> = {}
    const questionAnswers: Record<string, unknown> = {}

    answers.forEach((entry, stepId) => {
      if (entry.value === null) return
      if (stepId.startsWith('field:')) fields[stepId.slice('field:'.length)] = entry.value
      if (stepId.startsWith('question:'))
        questionAnswers[stepId.slice('question:'.length)] = entry.value
    })

    const subject = /^others?$/i.test(subCategoryValue)
      ? `${categoryName} - ${campus}`
      : `${subCategoryName} - ${campus}`

    return {
      category: valueOf('category') ?? '',
      categoryName,
      subCategory: subCategoryValue,
      subCategoryName,
      campus,
      description: valueOf('description') ?? '',
      fields,
      requestAnswers: requestForm.value
        ? { form_id: requestForm.value.id, answers: questionAnswers }
        : undefined,
      subject,
    }
  })

  return {
    load,
    loadError,
    metadata,
    category,
    subCategories,
    requestForm,
    steps,
    currentStep,
    isWaiting,
    isComplete,
    messages,
    request,
    answer,
    skip,
    pickMatch,
    change,
    searchMatches,
  }
}
