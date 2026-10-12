<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { emptyCondition, type ConditionField, type ConditionRow } from './automation.ts'
import AutomationConditionRow from './AutomationConditionRow.vue'

// Ticket conditions, all of which must match. One row per field.

const props = defineProps<{ fields: ConditionField[]; idPrefix: string }>()

const rows = defineModel<ConditionRow[]>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)
const unusedFields = computed(() => props.fields.filter((field) => !rows.value.some((row) => row.key === field.key)))

const add = (event: Event) => {
  const select = event.target as HTMLSelectElement
  const field = fieldOf(select.value)
  if (field) rows.value = [...rows.value, emptyCondition(field)]
  select.value = ''
}

const remove = (uid: number) => {
  rows.value = rows.value.filter((row) => row.uid !== uid)
}

const inputClass =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="!rows.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No conditions yet.') }}</p>
    <ul class="flex flex-col gap-2">
      <AutomationConditionRow
        v-for="(row, index) in rows"
        :key="row.uid"
        v-model="rows[index]"
        :field="fieldOf(row.key)"
        :id-prefix="idPrefix"
        @remove="remove(row.uid)"
      />
    </ul>

    <label v-if="unusedFields.length" :for="`${idPrefix}-add`" class="self-start">
      <span class="sr-only">{{ $t('Add a condition') }}</span>
      <select :id="`${idPrefix}-add`" :class="inputClass" @change="add">
        <option value="">{{ $t('+ Add a condition…') }}</option>
        <option v-for="field in unusedFields" :key="field.key" :value="field.key">{{ $t(field.label) }}</option>
      </select>
    </label>
  </div>
</template>
