<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { emptyCondition, type ConditionField, type ConditionRow } from './automation.ts'
import AutomationConditionRow from './AutomationConditionRow.vue'
import AutomationFieldSelect from './AutomationFieldSelect.vue'

// Ticket conditions, all of which must match. One row per field.

const props = defineProps<{ fields: ConditionField[]; idPrefix: string }>()

const rows = defineModel<ConditionRow[]>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)
const unusedFields = computed(() => props.fields.filter((field) => !rows.value.some((row) => row.key === field.key)))

const add = (key: string) => {
  const field = fieldOf(key)
  if (field) rows.value = [...rows.value, emptyCondition(field)]
}

const remove = (uid: number) => {
  rows.value = rows.value.filter((row) => row.uid !== uid)
}
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

    <AutomationFieldSelect
      v-if="unusedFields.length"
      :id="`${idPrefix}-add`"
      class="self-start"
      :fields="unusedFields"
      :label="$t('Add a condition')"
      :placeholder="$t('+ Add a condition…')"
      @pick="add"
    />
  </div>
</template>
