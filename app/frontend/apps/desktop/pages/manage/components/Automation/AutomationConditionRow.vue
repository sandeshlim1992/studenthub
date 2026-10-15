<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import {
  fieldLabel,
  fromLocalInput,
  isAbsoluteOperator,
  isListOperator,
  needsValue,
  operatorsOf,
  preConditionsOf,
  RELATIVE_RANGES,
  toLocalInput,
  type ConditionField,
  type ConditionRow,
} from './automation.ts'
import AutomationChoicePicker from './AutomationChoicePicker.vue'
import AutomationUserPicker from './AutomationUserPicker.vue'

// One condition: the field, how it is compared and with what. Used in the plain list and in the
// groups of expert mode.

const props = defineProps<{ field?: ConditionField; idPrefix: string }>()

const emit = defineEmits<{ remove: [] }>()

const row = defineModel<ConditionRow>({ required: true })

const id = (part: string) => `${props.idPrefix}-${part}-${row.value.uid}`

const kind = computed(() => props.field?.kind)
const label = computed(() => (props.field ? fieldLabel(props.field) : row.value.key))
const hasValue = computed(() => needsValue(row.value.operator))
const fixedDate = computed(() => isAbsoluteOperator(row.value.operator))

const single = computed({
  get: () => row.value.values[0] ?? '',
  set: (value: string) => {
    row.value.values = value ? [value] : []
  },
})

// A fixed time is kept as Zammad keeps it (ISO, UTC) and shown in the browser's time zone.
const date = computed({
  get: () => (props.field?.dateOnly ? row.value.text : toLocalInput(row.value.text)),
  set: (value: string) => {
    row.value.text = props.field?.dateOnly ? value : fromLocalInput(value)
  },
})

const inputClass =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <li
    class="flex flex-wrap items-start gap-2 rounded-lg border border-[var(--sh-line)] bg-white p-2.5"
    :aria-label="label"
  >
    <span class="min-w-36 pt-1.5 text-sm font-semibold text-[var(--sh-ink)]">{{ label }}</span>

    <span v-if="row.raw !== undefined" class="grow pt-1.5 text-xs text-[var(--sh-muted)]">
      {{ $t('Set elsewhere, kept as it is:') }}
      <code class="break-all">{{ JSON.stringify(row.raw) }}</code>
    </span>

    <template v-else>
      <label :for="id('op')">
        <span class="sr-only">{{ $t('Operator') }}</span>
        <select :id="id('op')" v-model="row.operator" :class="inputClass">
          <option
            v-for="operator in operatorsOf(field)"
            :key="operator.value"
            :value="operator.value"
          >
            {{ $t(operator.label) }}
          </option>
        </select>
      </label>

      <div v-if="hasValue" class="flex min-w-0 grow flex-wrap items-center gap-2">
        <label v-if="kind === 'date' && fixedDate" :for="id('date')">
          <span class="sr-only">{{ $t('Date') }}</span>
          <input
            :id="id('date')"
            v-model="date"
            :type="field?.dateOnly ? 'date' : 'datetime-local'"
            :class="inputClass"
          />
        </label>

        <template v-else-if="kind === 'date'">
          <label :for="id('amount')">
            <span class="sr-only">{{ $t('Amount') }}</span>
            <input
              :id="id('amount')"
              v-model="row.amount"
              type="number"
              min="1"
              :class="[inputClass, 'w-20']"
            />
          </label>
          <label :for="id('range')">
            <span class="sr-only">{{ $t('Unit') }}</span>
            <select :id="id('range')" v-model="row.range" :class="inputClass">
              <option v-for="range in RELATIVE_RANGES" :key="range.value" :value="range.value">
                {{ $t(range.label) }}
              </option>
            </select>
          </label>
        </template>

        <label v-else-if="kind === 'tags' || kind === 'text'" class="grow" :for="id('text')">
          <span class="sr-only">{{ $t('Value') }}</span>
          <input
            :id="id('text')"
            v-model="row.text"
            type="text"
            :class="[inputClass, 'w-full']"
            :placeholder="
              kind === 'tags'
                ? $t('Tags, separated by commas')
                : isListOperator(row.operator)
                  ? $t('Values, separated by commas')
                  : ''
            "
          />
        </label>

        <label v-else-if="kind === 'number'" :for="id('number')">
          <span class="sr-only">{{ $t('Value') }}</span>
          <input
            :id="id('number')"
            v-model="row.text"
            type="number"
            :class="[inputClass, 'w-28']"
          />
        </label>

        <label v-else-if="kind === 'single'" :for="id('value')">
          <span class="sr-only">{{ $t('Value') }}</span>
          <select :id="id('value')" v-model="single" :class="inputClass">
            <option value="" disabled>{{ $t('Choose…') }}</option>
            <option
              v-for="choice in field?.choices ?? []"
              :key="choice.value"
              :value="choice.value"
            >
              {{ $t(choice.label) }}
            </option>
          </select>
        </label>

        <template v-else-if="kind === 'owner' || kind === 'person'">
          <label :for="id('owner')">
            <span class="sr-only">{{ kind === 'owner' ? $t('Which owner') : $t('Who') }}</span>
            <select :id="id('owner')" v-model="row.preCondition" :class="inputClass">
              <option
                v-for="choice in preConditionsOf(field)"
                :key="choice.value"
                :value="choice.value"
              >
                {{ $t(choice.label) }}
              </option>
            </select>
          </label>
          <template v-if="row.preCondition === 'specific'">
            <AutomationUserPicker
              v-if="kind === 'person'"
              :id="id('person')"
              v-model="single"
              v-model:completion="row.completion"
            />
            <AutomationChoicePicker
              v-else
              :id="id('values')"
              v-model="row.values"
              :choices="field?.choices ?? []"
              :label="$t('Add an agent')"
            />
          </template>
        </template>

        <AutomationChoicePicker
          v-else
          :id="id('values')"
          v-model="row.values"
          :choices="field?.choices ?? []"
          :label="$t('Add a value')"
        />
      </div>
    </template>

    <button
      type="button"
      class="ms-auto rounded p-1.5 text-[var(--sh-muted)] hover:bg-red-50 hover:text-red-600"
      :aria-label="$t('Remove condition')"
      @click="emit('remove')"
    >
      <CommonIcon name="trash3" size="xs" decorative />
    </button>
  </li>
</template>
