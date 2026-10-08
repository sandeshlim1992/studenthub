<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import type { ChoiceOption } from './automation.ts'

// Several values: the chosen ones as chips (× removes), the rest in an "Add…" list.

const props = defineProps<{ choices: ChoiceOption[]; label: string; id: string }>()

const model = defineModel<string[]>({ required: true })

const labelOf = (value: string) => props.choices.find((choice) => choice.value === value)?.label ?? `#${value}`
const remaining = computed(() => props.choices.filter((choice) => !model.value.includes(choice.value)))

const add = (event: Event) => {
  const select = event.target as HTMLSelectElement
  if (select.value) model.value = [...model.value, select.value]
  select.value = ''
}

const remove = (value: string) => {
  model.value = model.value.filter((item) => item !== value)
}
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-1.5">
    <span
      v-for="value in model"
      :key="value"
      class="inline-flex items-center gap-1 rounded-md bg-[var(--sh-app-soft)] py-0.5 ps-2 pe-1 text-xs font-semibold text-[var(--sh-app)]"
    >
      {{ $t(labelOf(value)) }}
      <button
        type="button"
        class="rounded p-0.5 hover:bg-white/60"
        :aria-label="$t('Remove %s', $t(labelOf(value)))"
        @click="remove(value)"
      >
        <CommonIcon name="x-lg" size="xs" decorative />
      </button>
    </span>
    <label v-if="remaining.length" :for="id">
      <span class="sr-only">{{ label }}</span>
      <select
        :id="id"
        class="h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)]"
        @change="add"
      >
        <option value="">{{ $t('Add…') }}</option>
        <option v-for="choice in remaining" :key="choice.value" :value="choice.value">{{ $t(choice.label) }}</option>
      </select>
    </label>
  </div>
</template>
