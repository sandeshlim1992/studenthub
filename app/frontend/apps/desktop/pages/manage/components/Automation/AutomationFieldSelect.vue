<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

// Student Hub: the "+ Add …" list of a condition or action editor. Fields of the customer, the
// organization… come under their own heading, after the record's own fields.

interface Field {
  key: string
  label: string
  group?: string
}

const props = defineProps<{ fields: Field[]; id: string; label: string; placeholder: string }>()

const emit = defineEmits<{ pick: [key: string] }>()

const ownFields = computed(() => props.fields.filter((field) => !field.group))

const groups = computed(() =>
  [...new Set(props.fields.flatMap((field) => field.group ?? []))].map((group) => ({
    group,
    fields: props.fields.filter((field) => field.group === group),
  })),
)

const pick = (event: Event) => {
  const select = event.target as HTMLSelectElement
  if (select.value) emit('pick', select.value)
  select.value = ''
}
</script>

<template>
  <label :for="id">
    <span class="sr-only">{{ label }}</span>
    <select
      :id="id"
      class="h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]"
      @change="pick"
    >
      <option value="">{{ placeholder }}</option>
      <option v-for="field in ownFields" :key="field.key" :value="field.key">
        {{ $t(field.label) }}
      </option>
      <optgroup v-for="entry in groups" :key="entry.group" :label="$t(entry.group)">
        <option v-for="field in entry.fields" :key="field.key" :value="field.key">
          {{ $t(field.label) }}
        </option>
      </optgroup>
    </select>
  </label>
</template>
