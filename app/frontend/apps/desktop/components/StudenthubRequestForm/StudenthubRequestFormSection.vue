<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useId } from 'vue'

import Form from '#shared/components/Form/Form.vue'
import type { FormSchemaNode, FormValues } from '#shared/components/Form/types.ts'
import { useForm } from '#shared/components/Form/useForm.ts'
import { EnumObjectManagerObjects } from '#shared/graphql/types.ts'

import type { StudenthubRequestFormDefinition } from './types.ts'

// Student Hub: a request form's part of the student wizard's Details step: its heading, help text
// and the ticket fields it asks for, drawn by Zammad's own form fields. The admin page's preview
// shows the same component, so admins see exactly what the person raising the ticket gets.

const props = defineProps<{
  form: StudenthubRequestFormDefinition
}>()

const headingId = useId()

const { form: formRef, isValid } = useForm()

const schema = computed<FormSchemaNode[]>(() =>
  props.form.fields.map((field) => ({
    name: field.name,
    object: EnumObjectManagerObjects.Ticket,
    required: field.required,
  })),
)

// The form builds its fields once, so a change of fields (in the admin preview) draws it anew.
const schemaKey = computed(() =>
  props.form.fields.map((field) => `${field.name}:${field.required}`).join('|'),
)

// The answers, or null while a required one is missing (the form then shows what is missing).
const submit = async (): Promise<FormValues | null> => {
  const node = formRef.value?.formNode
  if (!node) return {}

  await node.settled
  if (!isValid.value) {
    node.submit()
    return null
  }

  return { ...formRef.value?.values }
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
    <Form :key="schemaKey" ref="formRef" class="mt-3" :schema="schema" />
  </section>
</template>
