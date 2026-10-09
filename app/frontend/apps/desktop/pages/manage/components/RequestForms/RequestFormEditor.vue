<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'

import type { RequestFormDefinition, RequestFormOptions } from './types.ts'

// Student Hub: the editor half of Administration → Request forms: when the form applies
// (Category › Sub-category), who it is for, its text and its fields.

const definition = defineModel<RequestFormDefinition>({ required: true })

const props = defineProps<{
  options: RequestFormOptions
  // "Category::Sub-category" of the other forms: each sub-category has one form.
  taken: Set<string>
}>()

const TYPE_LABELS: Record<string, string> = {
  input: __('Text'),
  textarea: __('Text area'),
  select: __('Select'),
  multiselect: __('Multiple select'),
  tree_select: __('Tree select'),
  multi_tree_select: __('Multiple tree select'),
  boolean: __('Yes / no'),
  integer: __('Number'),
  date: __('Date'),
  datetime: __('Date & time'),
}

const subCategories = computed(() => props.options.sub_categories[definition.value.category] ?? [])

const isTaken = (subCategory: string) =>
  props.taken.has(`${definition.value.category}::${subCategory}`)

watch(
  () => definition.value.category,
  () => {
    if (!subCategories.value.some((option) => option.value === definition.value.sub_category)) {
      definition.value.sub_category = ''
    }
  },
)

// "Only some" stays chosen while nothing is ticked yet.
const isLimited = ref(
  definition.value.organization_ids.length > 0 || definition.value.role_ids.length > 0,
)

const setLimited = (limited: boolean) => {
  isLimited.value = limited
  if (limited) return
  definition.value.organization_ids = []
  definition.value.role_ids = []
}

const toggleId = (key: 'organization_ids' | 'role_ids', id: number) => {
  const ids = definition.value[key]
  definition.value[key] = ids.includes(id)
    ? ids.filter((item) => item !== id)
    : [...ids, id].sort((a, b) => a - b)
}

const choiceFor = (name: string) => props.options.fields.find((field) => field.name === name)

// Fields that New ticket shows anyway: the form only changes whether they are required.
const alsoOn = (name: string) => {
  const shownFor = choiceFor(name)?.shown_for ?? []
  if (shownFor.length === 2) return __('also on every New ticket form')
  if (shownFor.includes('staff')) return __("also on staff's New ticket form")
  if (shownFor.includes('customers')) return __("also on customers' New ticket form")
  return null
}

const remainingChoices = computed(() =>
  props.options.fields.filter(
    (choice) => !definition.value.fields.some((field) => field.name === choice.name),
  ),
)

const fieldToAdd = ref('')

const addField = () => {
  if (!fieldToAdd.value) return
  definition.value.fields = [
    ...definition.value.fields,
    { name: fieldToAdd.value, required: false },
  ]
  fieldToAdd.value = ''
}

const moveField = (index: number, step: -1 | 1) => {
  const fields = [...definition.value.fields]
  const target = index + step
  if (target < 0 || target >= fields.length) return
  ;[fields[index], fields[target]] = [fields[target], fields[index]]
  definition.value.fields = fields
}

const removeField = (index: number) => {
  definition.value.fields = definition.value.fields.filter((_, position) => position !== index)
}

const setRequired = (index: number, required: boolean) => {
  const fields = [...definition.value.fields]
  fields[index] = { name: fields[index].name, required }
  definition.value.fields = fields
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const cardClass = 'flex flex-col gap-3 rounded-xl border border-[var(--sh-line)] bg-white p-5'
const labelClass = 'flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]'
const hintClass = 'text-xs font-normal text-[var(--sh-muted)]'
</script>

<template>
  <div class="flex flex-col gap-4">
    <section :class="cardClass" aria-labelledby="request-form-when">
      <h2 id="request-form-when" class="font-semibold text-[var(--sh-ink)]">
        {{ $t('When it applies') }}
      </h2>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label for="request-form-category" :class="labelClass">
          {{ $t('Category') }}
          <select id="request-form-category" v-model="definition.category" :class="inputClass">
            <option value="" disabled>{{ $t('Choose…') }}</option>
            <option
              v-for="category in options.categories"
              :key="category.value"
              :value="category.value"
            >
              {{ category.label }}
            </option>
          </select>
        </label>
        <label for="request-form-sub-category" :class="labelClass">
          {{ $t('Sub-category') }}
          <select
            id="request-form-sub-category"
            v-model="definition.sub_category"
            :class="inputClass"
            :disabled="!definition.category"
          >
            <option value="" disabled>{{ $t('Choose…') }}</option>
            <option
              v-for="subCategory in subCategories"
              :key="subCategory.value"
              :value="subCategory.value"
              :disabled="isTaken(subCategory.value)"
            >
              {{
                isTaken(subCategory.value)
                  ? $t('%s (has a form)', subCategory.label)
                  : subCategory.label
              }}
            </option>
          </select>
        </label>
      </div>
      <p :class="hintClass">
        {{
          $t(
            "The form is used when a ticket is raised under this sub-category, one form per sub-category. Afterwards staff see the answers in the ticket's details.",
          )
        }}
      </p>
    </section>

    <section :class="cardClass" aria-labelledby="request-form-who">
      <h2 id="request-form-who" class="font-semibold text-[var(--sh-ink)]">
        {{ $t('Who can use it') }}
      </h2>
      <div class="flex flex-col gap-2 text-sm text-[var(--sh-ink)]">
        <label for="request-form-everyone" class="flex items-center gap-2">
          <input
            id="request-form-everyone"
            type="radio"
            name="request-form-who"
            :checked="!isLimited"
            @change="setLimited(false)"
          />
          {{ $t('Everyone who can choose this sub-category') }}
        </label>
        <label for="request-form-limited" class="flex items-center gap-2">
          <input
            id="request-form-limited"
            type="radio"
            name="request-form-who"
            :checked="isLimited"
            @change="setLimited(true)"
          />
          {{ $t('Only some organisations or roles') }}
        </label>
      </div>
      <template v-if="isLimited">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <fieldset class="flex flex-col gap-1.5">
            <legend class="mb-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Organisations') }}
            </legend>
            <label
              v-for="organization in options.organizations"
              :key="organization.id"
              :for="`request-form-organization-${organization.id}`"
              class="flex items-center gap-2 text-sm text-[var(--sh-ink)]"
            >
              <input
                :id="`request-form-organization-${organization.id}`"
                type="checkbox"
                :checked="definition.organization_ids.includes(organization.id)"
                @change="toggleId('organization_ids', organization.id)"
              />
              {{ organization.name }}
            </label>
          </fieldset>
          <fieldset class="flex flex-col gap-1.5">
            <legend class="mb-1 text-sm font-semibold text-[var(--sh-ink)]">
              {{ $t('Roles') }}
            </legend>
            <label
              v-for="role in options.roles"
              :key="role.id"
              :for="`request-form-role-${role.id}`"
              class="flex items-center gap-2 text-sm text-[var(--sh-ink)]"
            >
              <input
                :id="`request-form-role-${role.id}`"
                type="checkbox"
                :checked="definition.role_ids.includes(role.id)"
                @change="toggleId('role_ids', role.id)"
              />
              {{ role.name }}
            </label>
          </fieldset>
        </div>
        <p :class="hintClass">
          {{
            $t(
              "Customers in one of the ticked organisations or roles get the form. Other customers don't see this sub-category when they raise a ticket; staff can still choose it.",
            )
          }}
        </p>
      </template>
    </section>

    <section :class="cardClass" aria-labelledby="request-form-text">
      <h2 id="request-form-text" class="font-semibold text-[var(--sh-ink)]">{{ $t('Text') }}</h2>
      <label for="request-form-title" :class="labelClass">
        {{ $t('Heading') }}
        <input
          id="request-form-title"
          v-model="definition.title"
          type="text"
          maxlength="120"
          :placeholder="definition.sub_category || $t('The sub-category')"
          :class="inputClass"
        />
      </label>
      <label for="request-form-help" :class="labelClass">
        {{ $t('Help text') }}
        <textarea
          id="request-form-help"
          v-model="definition.help_text"
          rows="3"
          maxlength="1000"
          :placeholder="
            $t(
              'e.g. Tell us about the new starter so we can set everything up before their first day.',
            )
          "
          :class="[inputClass, 'h-auto py-2']"
        />
      </label>
    </section>

    <section :class="cardClass" aria-labelledby="request-form-fields">
      <h2 id="request-form-fields" class="font-semibold text-[var(--sh-ink)]">
        {{ $t('Fields') }}
      </h2>
      <p v-if="!definition.fields.length" class="text-sm text-[var(--sh-muted)]">
        {{ $t('No fields yet.') }}
      </p>
      <ol v-else class="divide-y divide-[var(--sh-line)] rounded-lg border border-[var(--sh-line)]">
        <li
          v-for="(field, index) in definition.fields"
          :key="field.name"
          class="flex flex-wrap items-center gap-3 px-3 py-2"
          :aria-label="choiceFor(field.name)?.display ?? field.name"
        >
          <div class="flex flex-col">
            <button
              type="button"
              class="rounded p-0.5 text-[var(--sh-muted)] hover:text-[var(--sh-app)] disabled:opacity-30"
              :aria-label="$t('Move %s up', choiceFor(field.name)?.display ?? field.name)"
              :disabled="index === 0"
              @click="moveField(index, -1)"
            >
              <CommonIcon name="chevron-up" size="xs" decorative />
            </button>
            <button
              type="button"
              class="rounded p-0.5 text-[var(--sh-muted)] hover:text-[var(--sh-app)] disabled:opacity-30"
              :aria-label="$t('Move %s down', choiceFor(field.name)?.display ?? field.name)"
              :disabled="index === definition.fields.length - 1"
              @click="moveField(index, 1)"
            >
              <CommonIcon name="chevron-down" size="xs" decorative />
            </button>
          </div>
          <div class="flex min-w-0 grow flex-col">
            <span class="font-semibold text-[var(--sh-ink)]">{{
              choiceFor(field.name)?.display ?? field.name
            }}</span>
            <span v-if="!choiceFor(field.name)" class="text-xs font-semibold text-red-700">{{
              $t('This field no longer exists.')
            }}</span>
            <span v-else class="text-xs text-[var(--sh-muted)]">
              {{
                $t(
                  TYPE_LABELS[choiceFor(field.name)!.data_type] ?? choiceFor(field.name)!.data_type,
                )
              }}
              <template v-if="alsoOn(field.name)">· {{ $t(alsoOn(field.name)!) }}</template>
            </span>
          </div>
          <label
            :for="`request-form-required-${field.name}`"
            class="flex items-center gap-1.5 text-sm text-[var(--sh-ink)]"
          >
            <input
              :id="`request-form-required-${field.name}`"
              type="checkbox"
              :checked="field.required"
              @change="setRequired(index, ($event.target as HTMLInputElement).checked)"
            />
            {{ $t('Required') }}
          </label>
          <CommonButton
            variant="remove"
            size="small"
            icon="trash3"
            :aria-label="$t('Remove %s', choiceFor(field.name)?.display ?? field.name)"
            @click="removeField(index)"
          />
        </li>
      </ol>

      <div class="flex flex-wrap items-end gap-2">
        <label for="request-form-add-field" :class="[labelClass, 'min-w-48 grow']">
          {{ $t('Add a field') }}
          <select id="request-form-add-field" v-model="fieldToAdd" :class="inputClass">
            <option value="" disabled>{{ $t('Choose a ticket field…') }}</option>
            <option v-for="choice in remainingChoices" :key="choice.name" :value="choice.name">
              {{ choice.display }} ({{ $t(TYPE_LABELS[choice.data_type] ?? choice.data_type) }})
            </option>
          </select>
        </label>
        <CommonButton
          variant="secondary"
          size="medium"
          prefix-icon="plus"
          :disabled="!fieldToAdd"
          @click="addField"
        >
          {{ $t('Add') }}
        </CommonButton>
      </div>
      <p :class="hintClass">
        {{ $t('Need a new field? Create it under') }}
        <RouterLink
          to="/manage/system/objects"
          class="font-semibold text-[var(--sh-app)] hover:underline"
          >{{ $t('Objects') }}</RouterLink
        >
        {{
          $t(
            'and set it not to show on New ticket: it then appears only on the forms that ask for it. Fields marked "also on…" show on that New ticket form anyway; the form can make them required.',
          )
        }}
      </p>
    </section>
  </div>
</template>
