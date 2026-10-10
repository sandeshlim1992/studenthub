<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useId } from 'vue'

import Form from '#shared/components/Form/Form.vue'
import { useForm } from '#shared/components/Form/useForm.ts'

import {
  HEADING_CLASS,
  NOTE_CLASS,
  requestFormSchema,
  splitRequestFormValues,
} from './requestFormSchema.ts'
import {
  requestFormItems,
  type StudenthubRequestFormDefinition,
  type StudenthubRequestFormResult,
} from './types.ts'

// Student Hub: a request form's part of the student wizard's Details step: its heading, help text
// and its items in order (the ticket fields it asks for, drawn by Zammad's own form fields, with
// headings and notes between them). The admin page's preview shows the same component, so admins
// see exactly what the person raising the ticket gets.

const props = defineProps<{
  form: StudenthubRequestFormDefinition
}>()

const headingId = useId()

const { form: formRef, isValid } = useForm()

const items = computed(() => requestFormItems(props.form))
const schema = computed(() => requestFormSchema(props.form))

// Zammad's form waits for a field before it shows anything, so headings and notes alone (a draft
// in the admin preview) are drawn here.
const hasFields = computed(() =>
  items.value.some((item) => item.type === 'field' || item.type === 'question'),
)

// The form builds its fields once, so a change of items (in the admin preview) draws it anew.
const schemaKey = computed(() => JSON.stringify(items.value))

// The Zammad fields' values and the answers to the form's own questions, or null while a required
// one is missing (the form then shows what is missing).
const submit = async (): Promise<StudenthubRequestFormResult | null> => {
  const node = formRef.value?.formNode
  if (!node) return { fields: {}, answers: {} }

  await node.settled
  if (!isValid.value) {
    node.submit()
    return null
  }

  return splitRequestFormValues({ ...formRef.value?.values })
}

defineExpose({ submit })
</script>

<template>
  <section
    class="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5"
    :aria-labelledby="headingId"
    data-test-id="studenthub-request-form"
  >
    <h3 :id="headingId" class="text-sm font-bold text-slate-900 sm:text-base">
      {{ form.title || form.sub_category }}
    </h3>
    <p
      v-if="form.help_text"
      class="mt-1 text-sm leading-relaxed whitespace-pre-line text-slate-600"
    >
      {{ form.help_text }}
    </p>
    <Form v-if="hasFields" :key="schemaKey" ref="formRef" class="mt-3" :schema="schema" />
    <div v-else class="mt-3 flex flex-col gap-2">
      <template v-for="(item, index) in items" :key="index">
        <h4 v-if="item.type === 'heading'" :class="HEADING_CLASS">{{ item.text }}</h4>
        <p v-else-if="item.type === 'note'" :class="NOTE_CLASS">{{ item.text }}</p>
      </template>
    </div>
  </section>
</template>
