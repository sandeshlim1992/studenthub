<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import {
  CHOICE_OPERATORS,
  emptyCondition,
  RELATIVE_OPERATORS,
  RELATIVE_RANGES,
  TAG_OPERATORS,
  TEXT_OPERATORS,
  type ConditionField,
  type ConditionRow,
} from './automation.ts'
import AutomationChoicePicker from './AutomationChoicePicker.vue'

// Ticket conditions, all of which must match. One row per field.

const props = defineProps<{ fields: ConditionField[]; idPrefix: string }>()

const rows = defineModel<ConditionRow[]>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)
const unusedFields = computed(() => props.fields.filter((field) => !rows.value.some((row) => row.key === field.key)))

const operatorsOf = (field?: ConditionField) => {
  switch (field?.kind) {
    case 'date':
      return RELATIVE_OPERATORS
    case 'tags':
      return TAG_OPERATORS
    case 'text':
      return TEXT_OPERATORS
    default:
      return CHOICE_OPERATORS
  }
}

const add = (event: Event) => {
  const select = event.target as HTMLSelectElement
  const field = fieldOf(select.value)
  if (field) rows.value = [...rows.value, emptyCondition(field)]
  select.value = ''
}

const remove = (uid: number) => {
  rows.value = rows.value.filter((row) => row.uid !== uid)
}

const describeKept = (row: ConditionRow) => JSON.stringify(row.raw)

const inputClass =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="!rows.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No conditions yet.') }}</p>
    <ul class="flex flex-col gap-2">
      <li
        v-for="row in rows"
        :key="row.uid"
        class="flex flex-wrap items-start gap-2 rounded-lg border border-[var(--sh-line)] bg-white p-2.5"
        :aria-label="fieldOf(row.key) ? $t(fieldOf(row.key)!.label) : row.key"
      >
        <span class="min-w-36 pt-1.5 text-sm font-semibold text-[var(--sh-ink)]">
          {{ fieldOf(row.key) ? $t(fieldOf(row.key)!.label) : row.key }}
        </span>

        <template v-if="row.raw !== undefined">
          <span class="grow pt-1.5 text-xs text-[var(--sh-muted)]">
            {{ $t('Set elsewhere, kept as it is:') }} <code class="break-all">{{ describeKept(row) }}</code>
          </span>
        </template>

        <template v-else>
          <label :for="`${idPrefix}-op-${row.uid}`">
            <span class="sr-only">{{ $t('Operator') }}</span>
            <select :id="`${idPrefix}-op-${row.uid}`" v-model="row.operator" :class="inputClass">
              <option v-for="operator in operatorsOf(fieldOf(row.key))" :key="operator.value" :value="operator.value">
                {{ $t(operator.label) }}
              </option>
            </select>
          </label>

          <div class="flex min-w-0 grow flex-wrap items-center gap-2">
            <template v-if="fieldOf(row.key)?.kind === 'date'">
              <label :for="`${idPrefix}-amount-${row.uid}`">
                <span class="sr-only">{{ $t('Amount') }}</span>
                <input
                  :id="`${idPrefix}-amount-${row.uid}`"
                  v-model="row.amount"
                  type="number"
                  min="1"
                  :class="[inputClass, 'w-20']"
                />
              </label>
              <label :for="`${idPrefix}-range-${row.uid}`">
                <span class="sr-only">{{ $t('Unit') }}</span>
                <select :id="`${idPrefix}-range-${row.uid}`" v-model="row.range" :class="inputClass">
                  <option v-for="range in RELATIVE_RANGES" :key="range.value" :value="range.value">
                    {{ $t(range.label) }}
                  </option>
                </select>
              </label>
            </template>

            <label v-else-if="fieldOf(row.key)?.kind === 'tags' || fieldOf(row.key)?.kind === 'text'" class="grow" :for="`${idPrefix}-text-${row.uid}`">
              <span class="sr-only">{{ $t('Value') }}</span>
              <input
                :id="`${idPrefix}-text-${row.uid}`"
                v-model="row.text"
                type="text"
                :class="[inputClass, 'w-full']"
                :placeholder="fieldOf(row.key)?.kind === 'tags' ? $t('Tags, separated by commas') : ''"
              />
            </label>

            <template v-else-if="fieldOf(row.key)?.kind === 'owner'">
              <label :for="`${idPrefix}-owner-${row.uid}`">
                <span class="sr-only">{{ $t('Which owner') }}</span>
                <select :id="`${idPrefix}-owner-${row.uid}`" v-model="row.preCondition" :class="inputClass">
                  <option value="not_set">{{ $t('nobody (unassigned)') }}</option>
                  <option value="specific">{{ $t('one of these agents') }}</option>
                </select>
              </label>
              <AutomationChoicePicker
                v-if="row.preCondition === 'specific'"
                :id="`${idPrefix}-values-${row.uid}`"
                v-model="row.values"
                :choices="fieldOf(row.key)?.choices ?? []"
                :label="$t('Add an agent')"
              />
            </template>

            <AutomationChoicePicker
              v-else
              :id="`${idPrefix}-values-${row.uid}`"
              v-model="row.values"
              :choices="fieldOf(row.key)?.choices ?? []"
              :label="$t('Add a value')"
            />
          </div>
        </template>

        <button
          type="button"
          class="ms-auto rounded p-1.5 text-[var(--sh-muted)] hover:bg-red-50 hover:text-red-600"
          :aria-label="$t('Remove condition')"
          @click="remove(row.uid)"
        >
          <CommonIcon name="trash3" size="xs" decorative />
        </button>
      </li>
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
