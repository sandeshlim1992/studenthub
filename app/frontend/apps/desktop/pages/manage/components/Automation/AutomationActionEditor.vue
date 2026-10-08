<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { EMAIL_RECIPIENTS, emptyAction, type ActionField, type ActionRow } from './automation.ts'
import AutomationChoicePicker from './AutomationChoicePicker.vue'

// What happens to each matching ticket. One row per action.

const props = defineProps<{ fields: ActionField[]; idPrefix: string }>()

const rows = defineModel<ActionRow[]>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)
const unusedFields = computed(() => props.fields.filter((field) => !rows.value.some((row) => row.key === field.key)))

const add = (event: Event) => {
  const select = event.target as HTMLSelectElement
  const field = fieldOf(select.value)
  if (field) rows.value = [...rows.value, emptyAction(field)]
  select.value = ''
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

    <label v-if="unusedFields.length" :for="`${idPrefix}-add`" class="self-start">
      <span class="sr-only">{{ $t('Add an action') }}</span>
      <select :id="`${idPrefix}-add`" :class="inputClass" @change="add">
        <option value="">{{ $t('+ Add an action…') }}</option>
        <option v-for="field in unusedFields" :key="field.key" :value="field.key">{{ $t(field.label) }}</option>
      </select>
    </label>
  </div>
</template>
