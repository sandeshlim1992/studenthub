<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type {
  ChecklistAssignmentsData,
  ChecklistCategoryOption,
  ChecklistSubCategory,
} from './types.ts'

// Student Hub: the Category › Sub-category pairs whose tickets get this checklist automatically
// (Studenthub::ChecklistAssignments). A pair another checklist gets already can't be chosen; one
// the Category / Sub-category fields no longer offer stays listed until it is taken off.

const props = defineProps<{
  templateId: number | null
  data: ChecklistAssignmentsData
  templateNames: Record<number, string>
}>()

const chosen = defineModel<ChecklistSubCategory[]>({ required: true })

const category = ref('')
const subCategory = ref('')

watch(category, () => {
  subCategory.value = ''
})

const pairKey = (pair: ChecklistSubCategory) => JSON.stringify([pair.category, pair.sub_category])

// The pairs other checklists get, with that checklist's name.
const takenBy = computed(
  () =>
    new Map(
      props.data.assignments
        .filter((assignment) => assignment.checklist_template_id !== props.templateId)
        .map((assignment) => [
          pairKey(assignment),
          props.templateNames[assignment.checklist_template_id] ?? '',
        ]),
    ),
)

const isChosen = (pair: ChecklistSubCategory) =>
  chosen.value.some((item) => pairKey(item) === pairKey(pair))

const optionsOf = (value: string): ChecklistCategoryOption[] => props.data.sub_categories[value] ?? []

const categoryLabel = (value: string) =>
  props.data.categories.find((option) => option.value === value)?.label ?? value

const subCategoryLabel = (pair: ChecklistSubCategory) =>
  optionsOf(pair.category).find((option) => option.value === pair.sub_category)?.label ??
  pair.sub_category

const isMissing = (pair: ChecklistSubCategory) =>
  !optionsOf(pair.category).some((option) => option.value === pair.sub_category)

const subCategoryChoices = computed(() =>
  optionsOf(category.value).map((option) => {
    const pair = { category: category.value, sub_category: option.value }
    return { ...option, takenBy: takenBy.value.get(pairKey(pair)), chosen: isChosen(pair) }
  }),
)

const add = () => {
  if (!category.value || !subCategory.value) return
  chosen.value = [...chosen.value, { category: category.value, sub_category: subCategory.value }]
  subCategory.value = ''
}

const remove = (pair: ChecklistSubCategory) => {
  chosen.value = chosen.value.filter((item) => pairKey(item) !== pairKey(pair))
}

const selectClass =
  'w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-normal normal-case tracking-normal text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500 disabled:opacity-50'
</script>

<template>
  <section aria-labelledby="checklist-sub-categories-heading">
    <h3
      id="checklist-sub-categories-heading"
      class="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
    >
      {{ $t('Add automatically to tickets in') }}
    </h3>
    <p class="mt-1 mb-3 text-xs text-slate-500 dark:text-slate-400">
      {{
        $t(
          'Tickets created in these sub-categories, or moved there later, get this checklist unless they already have one.',
        )
      }}
    </p>

    <ul v-if="chosen.length" class="mb-3 flex flex-wrap gap-2">
      <li
        v-for="pair in chosen"
        :key="pairKey(pair)"
        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-1 ps-2.5 pe-1 text-xs text-slate-700 dark:text-slate-200"
      >
        <span>{{ categoryLabel(pair.category) }} › {{ subCategoryLabel(pair) }}</span>
        <span v-if="isMissing(pair)" class="font-semibold text-red-700 dark:text-red-400">
          {{ $t('No longer a sub-category') }}
        </span>
        <button
          type="button"
          class="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
          :aria-label="$t('Remove %s', `${categoryLabel(pair.category)} › ${subCategoryLabel(pair)}`)"
          @click="remove(pair)"
        >
          <CommonIcon name="x-lg" size="xs" decorative />
        </button>
      </li>
    </ul>
    <p v-else class="mb-3 text-xs text-slate-500 dark:text-slate-400">
      {{ $t('Not added automatically yet.') }}
    </p>

    <div class="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label
        for="checklist-category"
        class="flex flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        {{ $t('Category') }}
        <select id="checklist-category" v-model="category" :class="selectClass">
          <option value="">{{ $t('Choose…') }}</option>
          <option v-for="option in data.categories" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <label
        for="checklist-sub-category"
        class="flex flex-col gap-1 text-xs font-semibold text-slate-500 dark:text-slate-400"
      >
        {{ $t('Sub-category') }}
        <select
          id="checklist-sub-category"
          v-model="subCategory"
          :class="selectClass"
          :disabled="!category"
        >
          <option value="">{{ $t('Choose…') }}</option>
          <option
            v-for="choice in subCategoryChoices"
            :key="choice.value"
            :value="choice.value"
            :disabled="Boolean(choice.takenBy) || choice.chosen"
          >
            {{
              choice.takenBy
                ? $t('%s (gets "%s")', choice.label, choice.takenBy)
                : choice.label
            }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!subCategory"
        @click="add"
      >
        {{ $t('Add') }}
      </button>
    </div>
  </section>
</template>
