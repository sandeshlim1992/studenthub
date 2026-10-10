<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref } from 'vue'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import type {
  StudenthubRequestFormQuestion,
  StudenthubRequestFormQuestionKind,
} from '#desktop/components/StudenthubRequestForm/types.ts'

import { QUESTION_KIND_LABELS } from './types.ts'

// Student Hub: adding or changing one of a request form's own questions (Administration → Request
// forms). Its answers are not a Zammad ticket field: they go into the ticket's Request details and
// are saved by Student Hub. A published question keeps its type, so its answers keep their meaning.

const props = defineProps<{
  // The question being changed; none for a new one.
  question?: StudenthubRequestFormQuestion
  // The question is published: its type can't change.
  kindLocked?: boolean
}>()

const emit = defineEmits<{
  save: [Omit<StudenthubRequestFormQuestion, 'key'>]
  cancel: []
}>()

const label = ref(props.question?.label ?? '')
const kind = ref<StudenthubRequestFormQuestionKind>(props.question?.kind ?? 'text')
const optionsText = ref((props.question?.options ?? []).join('\n'))
const help = ref(props.question?.help ?? '')
const required = ref(props.question?.required ?? false)

const hasOptions = computed(() => kind.value === 'select' || kind.value === 'multiselect')
const options = computed(() =>
  optionsText.value
    .split('\n')
    .map((option) => option.trim())
    .filter((option, index, all) => option && all.indexOf(option) === index),
)

const canSave = computed(
  () => label.value.trim().length > 0 && (!hasOptions.value || options.value.length > 0),
)

const save = () => {
  if (!canSave.value) return

  emit('save', {
    type: 'question',
    label: label.value.trim(),
    kind: kind.value,
    help: help.value.trim(),
    required: kind.value !== 'boolean' && required.value,
    ...(hasOptions.value ? { options: options.value } : {}),
  })
}

const inputClass =
  'h-9 w-full rounded-lg border border-[var(--sh-line)] bg-white px-3 text-sm font-normal text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)] disabled:bg-slate-50 disabled:text-[var(--sh-muted)]'
const labelClass = 'flex flex-col gap-1 text-sm font-semibold text-[var(--sh-ink)]'
const hintClass = 'text-xs font-normal text-[var(--sh-muted)]'
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-lg border border-[var(--sh-app-border)] bg-[var(--sh-app-soft)]/40 p-4"
    :aria-label="question ? $t('Change question') : $t('New question')"
  >
    <h3 class="text-sm font-semibold text-[var(--sh-ink)]">
      {{ question ? $t('Change question') : $t('New question') }}
    </h3>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <label for="request-form-question-label" :class="labelClass">
        {{ $t('Question') }}
        <input
          id="request-form-question-label"
          v-model="label"
          type="text"
          maxlength="120"
          :placeholder="$t('e.g. Employee full name')"
          :class="inputClass"
        />
      </label>
      <label for="request-form-question-kind" :class="labelClass">
        {{ $t('Type') }}
        <select
          id="request-form-question-kind"
          v-model="kind"
          :class="inputClass"
          :disabled="kindLocked"
        >
          <option v-for="(kindLabel, value) in QUESTION_KIND_LABELS" :key="value" :value="value">
            {{ $t(kindLabel) }}
          </option>
        </select>
        <span v-if="kindLocked" :class="hintClass">{{
          $t("A published question keeps its type; add a new question for another type.")
        }}</span>
      </label>
    </div>
    <label v-if="hasOptions" for="request-form-question-options" :class="labelClass">
      {{ $t('Options, one per line') }}
      <textarea
        id="request-form-question-options"
        v-model="optionsText"
        rows="4"
        :class="[inputClass, 'h-auto py-2']"
        :placeholder="$t('e.g. Standard laptop')"
      />
    </label>
    <label for="request-form-question-help" :class="labelClass">
      {{ $t('Help text') }}
      <input
        id="request-form-question-help"
        v-model="help"
        type="text"
        maxlength="500"
        :placeholder="$t('Shown under the question, e.g. as on their contract.')"
        :class="inputClass"
      />
    </label>
    <label
      v-if="kind !== 'boolean'"
      for="request-form-question-required"
      class="flex items-center gap-1.5 text-sm text-[var(--sh-ink)]"
    >
      <input id="request-form-question-required" v-model="required" type="checkbox" />
      {{ $t('Required') }}
    </label>
    <div class="flex flex-wrap justify-end gap-2">
      <CommonButton variant="tertiary" size="medium" @click="emit('cancel')">
        {{ $t('Cancel') }}
      </CommonButton>
      <CommonButton variant="primary" size="medium" :disabled="!canSave" @click="save">
        {{ question ? $t('Save question') : $t('Add question') }}
      </CommonButton>
    </div>
  </section>
</template>
