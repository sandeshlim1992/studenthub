<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import Form from '#shared/components/Form/Form.vue'
import type { FormFieldValue } from '#shared/components/Form/types.ts'
import { defineFormSchema } from '#shared/form/defineFormSchema.ts'

// Student Hub: a formatted text (a template's message), with the editor of the Knowledge Base page.
// Only what the admin changes is taken over, so opening and saving keeps the text as it was.

const props = defineProps<{ id: string; label: string }>()

const text = defineModel<string>({ required: true })

const schema = defineFormSchema([
  { type: 'editor', name: 'text', label: props.label, labelSrOnly: true },
])

const initialValues = { text: text.value }

const takeOver = (fieldName: string, value: FormFieldValue) => {
  if (fieldName === 'text') text.value = String(value ?? '')
}
</script>

<template>
  <Form :id="id" :schema="schema" :initial-values="initialValues" @changed="takeOver" />
</template>
