<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import {
  EMAIL_RECIPIENTS,
  emptyAction,
  fromLocalInput,
  RELATIVE_RANGES,
  toLocalInput,
  type ActionField,
  type ActionRow,
} from './automation.ts'
import AutomationChoicePicker from './AutomationChoicePicker.vue'
import AutomationFieldSelect from './AutomationFieldSelect.vue'
import AutomationRichText from './AutomationRichText.vue'
import AutomationUserPicker from './AutomationUserPicker.vue'

// What happens to each matching ticket, user or organization (or what a template fills in). One row
// per action.

const props = defineProps<{ fields: ActionField[]; idPrefix: string }>()

const rows = defineModel<ActionRow[]>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)
const unusedFields = computed(() => props.fields.filter((field) => !rows.value.some((row) => row.key === field.key)))

const add = (key: string) => {
  const field = fieldOf(key)
  if (field) rows.value = [...rows.value, emptyAction(field)]
}

// A fixed time is kept as Zammad keeps it (ISO, UTC) and shown in the browser's time zone.
const fixedDateOf = (row: ActionRow) => (fieldOf(row.key)?.dateOnly ? row.value : toLocalInput(row.value))

const setFixedDate = (row: ActionRow, value: string) => {
  row.value = fieldOf(row.key)?.dateOnly ? value : fromLocalInput(value)
}

// Switching between a fixed and a relative date starts the value again.
const setDateOperator = (row: ActionRow, operator: string) => {
  row.operator = operator
  row.value = operator === 'relative' ? '1' : ''
}

const remove = (uid: number) => {
  rows.value = rows.value.filter((row) => row.uid !== uid)
}

const inputClass =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
const areaClass =
  'min-h-24 w-full rounded-lg border border-[var(--sh-line)] bg-white px-2 py-1.5 font-mono text-xs text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <div class="flex flex-col gap-2">
    <p v-if="!rows.length" class="text-sm text-[var(--sh-muted)]">{{ $t('No actions yet.') }}</p>
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

        <div class="flex min-w-0 grow flex-col gap-2">
          <span v-if="row.raw !== undefined" class="pt-1.5 text-xs text-[var(--sh-muted)]">
            {{ $t('Set elsewhere, kept as it is:') }} <code class="break-all">{{ JSON.stringify(row.raw) }}</code>
          </span>

          <template v-else-if="fieldOf(row.key)?.kind === 'tags'">
            <div class="flex flex-wrap items-center gap-2">
              <label :for="`${idPrefix}-tagop-${row.uid}`">
                <span class="sr-only">{{ $t('Add or remove') }}</span>
                <select :id="`${idPrefix}-tagop-${row.uid}`" v-model="row.operator" :class="inputClass">
                  <option value="add">{{ $t('add') }}</option>
                  <option value="remove">{{ $t('remove') }}</option>
                </select>
              </label>
              <label :for="`${idPrefix}-tags-${row.uid}`" class="grow">
                <span class="sr-only">{{ $t('Tags') }}</span>
                <input
                  :id="`${idPrefix}-tags-${row.uid}`"
                  v-model="row.value"
                  type="text"
                  :class="[inputClass, 'w-full']"
                  :placeholder="$t('Tags, separated by commas')"
                />
              </label>
            </div>
          </template>

          <template v-else-if="fieldOf(row.key)?.kind === 'note'">
            <label :for="`${idPrefix}-subject-${row.uid}`" class="flex flex-col gap-1 text-xs text-[var(--sh-muted)]">
              {{ $t('Subject') }}
              <input :id="`${idPrefix}-subject-${row.uid}`" v-model="row.subject" type="text" :class="[inputClass, 'w-full']" />
            </label>
            <label :for="`${idPrefix}-body-${row.uid}`" class="flex flex-col gap-1 text-xs text-[var(--sh-muted)]">
              {{ $t('Text (HTML)') }}
              <textarea :id="`${idPrefix}-body-${row.uid}`" v-model="row.body" :class="areaClass" />
            </label>
            <label :for="`${idPrefix}-internal-${row.uid}`" class="flex items-center gap-2 text-sm text-[var(--sh-ink)]">
              <input :id="`${idPrefix}-internal-${row.uid}`" v-model="row.internal" type="checkbox" />
              {{ $t('Internal (not visible to the customer)') }}
            </label>
          </template>

          <template v-else-if="fieldOf(row.key)?.kind === 'email'">
            <div class="flex flex-wrap items-center gap-2 text-xs text-[var(--sh-muted)]">
              {{ $t('To') }}
              <AutomationChoicePicker
                :id="`${idPrefix}-recipients-${row.uid}`"
                v-model="row.recipients"
                :choices="EMAIL_RECIPIENTS"
                :label="$t('Add a recipient')"
              />
            </div>
            <label :for="`${idPrefix}-subject-${row.uid}`" class="flex flex-col gap-1 text-xs text-[var(--sh-muted)]">
              {{ $t('Subject') }}
              <input :id="`${idPrefix}-subject-${row.uid}`" v-model="row.subject" type="text" :class="[inputClass, 'w-full']" />
            </label>
            <label :for="`${idPrefix}-body-${row.uid}`" class="flex flex-col gap-1 text-xs text-[var(--sh-muted)]">
              {{ $t('Text (HTML; placeholders like #{ticket.number} work)') }}
              <textarea :id="`${idPrefix}-body-${row.uid}`" v-model="row.body" :class="[areaClass, 'min-h-40']" />
            </label>
          </template>

          <p v-else-if="fieldOf(row.key)?.kind === 'delete'" class="pt-1.5 text-sm font-semibold text-red-700">
            {{ $t('Matching tickets are deleted for good, with all their messages.') }}
          </p>

          <p v-else-if="fieldOf(row.key)?.kind === 'privacy'" class="pt-1.5 text-sm font-semibold text-red-700">
            {{
              $t(
                'Matching users and their tickets as customer are scheduled for deletion. Once the data privacy task runs, they are deleted for good (a history entry is kept). This cannot be undone.',
              )
            }}
          </p>

          <AutomationChoicePicker
            v-else-if="fieldOf(row.key)?.kind === 'multichoice'"
            :id="`${idPrefix}-values-${row.uid}`"
            v-model="row.values"
            :choices="fieldOf(row.key)?.choices ?? []"
            :label="$t('Add a value')"
          />

          <div v-else-if="fieldOf(row.key)?.kind === 'date'" class="flex flex-wrap items-center gap-2">
            <label :for="`${idPrefix}-when-${row.uid}`">
              <span class="sr-only">{{ $t('When') }}</span>
              <select
                :id="`${idPrefix}-when-${row.uid}`"
                :value="row.operator"
                :class="inputClass"
                @change="setDateOperator(row, ($event.target as HTMLSelectElement).value)"
              >
                <option value="relative">{{ $t('in …') }}</option>
                <option value="static">{{ $t('on the date') }}</option>
              </select>
            </label>
            <template v-if="row.operator === 'relative'">
              <label :for="`${idPrefix}-amount-${row.uid}`">
                <span class="sr-only">{{ $t('Amount') }}</span>
                <input :id="`${idPrefix}-amount-${row.uid}`" v-model="row.value" type="number" min="1" :class="[inputClass, 'w-20']" />
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
            <label v-else :for="`${idPrefix}-date-${row.uid}`">
              <span class="sr-only">{{ $t('Date') }}</span>
              <input
                :id="`${idPrefix}-date-${row.uid}`"
                :value="fixedDateOf(row)"
                :type="fieldOf(row.key)?.dateOnly ? 'date' : 'datetime-local'"
                :class="inputClass"
                @input="setFixedDate(row, ($event.target as HTMLInputElement).value)"
              />
            </label>
          </div>

          <AutomationRichText
            v-else-if="fieldOf(row.key)?.kind === 'richtext'"
            :id="`${idPrefix}-richtext-${row.uid}`"
            v-model="row.value"
            :label="$t(fieldOf(row.key)!.label)"
          />

          <label v-else-if="fieldOf(row.key)?.kind === 'text'" :for="`${idPrefix}-text-${row.uid}`">
            <span class="sr-only">{{ $t('Value') }}</span>
            <input :id="`${idPrefix}-text-${row.uid}`" v-model="row.value" type="text" :class="[inputClass, 'w-full']" />
          </label>

          <div v-else-if="fieldOf(row.key)?.kind === 'customer'" class="flex flex-wrap items-start gap-2">
            <label :for="`${idPrefix}-who-${row.uid}`">
              <span class="sr-only">{{ $t('Who') }}</span>
              <select :id="`${idPrefix}-who-${row.uid}`" v-model="row.preCondition" :class="inputClass">
                <option value="current_user.id">{{ $t('the current user') }}</option>
                <option value="specific">{{ $t('a specific person') }}</option>
              </select>
            </label>
            <AutomationUserPicker
              v-if="row.preCondition === 'specific'"
              :id="`${idPrefix}-person-${row.uid}`"
              v-model="row.value"
              v-model:completion="row.completion"
            />
          </div>

          <label v-else :for="`${idPrefix}-value-${row.uid}`">
            <span class="sr-only">{{ $t('Value') }}</span>
            <select :id="`${idPrefix}-value-${row.uid}`" v-model="row.value" :class="inputClass">
              <option value="" disabled>{{ $t('Choose…') }}</option>
              <option v-for="choice in fieldOf(row.key)?.choices ?? []" :key="choice.value" :value="choice.value">
                {{ $t(choice.label) }}
              </option>
            </select>
          </label>
        </div>

        <button
          type="button"
          class="rounded p-1.5 text-[var(--sh-muted)] hover:bg-red-50 hover:text-red-600"
          :aria-label="$t('Remove action')"
          @click="remove(row.uid)"
        >
          <CommonIcon name="trash3" size="xs" decorative />
        </button>
      </li>
    </ul>

    <AutomationFieldSelect
      v-if="unusedFields.length"
      :id="`${idPrefix}-add`"
      class="self-start"
      :fields="unusedFields"
      :label="$t('Add an action')"
      :placeholder="$t('+ Add an action…')"
      @pick="add"
    />
  </div>
</template>
