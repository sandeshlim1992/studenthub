<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import {
  emptyCondition,
  GROUP_OPERATORS,
  isGroup,
  newGroup,
  type ConditionField,
  type ConditionGroup,
} from './automation.ts'
import AutomationConditionRow from './AutomationConditionRow.vue'

// Expert mode: a group of conditions and groups, of which all, any or none must match. A field can
// be used more than once (e.g. "state has changed" and "state is closed").

const props = defineProps<{ fields: ConditionField[]; idPrefix: string; removable?: boolean }>()

const emit = defineEmits<{ remove: [] }>()

const group = defineModel<ConditionGroup>({ required: true })

const fieldOf = (key: string) => props.fields.find((field) => field.key === key)

const addCondition = (event: Event) => {
  const select = event.target as HTMLSelectElement
  const field = fieldOf(select.value)
  if (field) group.value.children = [...group.value.children, emptyCondition(field)]
  select.value = ''
}

const addGroup = () => {
  group.value.children = [...group.value.children, newGroup('OR')]
}

const remove = (uid: number) => {
  group.value.children = group.value.children.filter((child) => child.uid !== uid)
}

const inputClass =
  'h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] outline-none focus:border-[var(--sh-app)] focus:ring-2 focus:ring-[var(--sh-app-soft)]'
</script>

<template>
  <div
    class="flex flex-col gap-2 rounded-lg border border-dashed border-[var(--sh-app-border)] bg-[var(--sh-app-soft)] p-2.5"
    role="group"
    :aria-label="$t('Condition group')"
  >
    <div class="flex flex-wrap items-center gap-2">
      <label
        :for="`${idPrefix}-groupop-${group.uid}`"
        class="flex items-center gap-2 text-sm font-semibold text-[var(--sh-ink)]"
      >
        {{ $t('Match') }}
        <select
          :id="`${idPrefix}-groupop-${group.uid}`"
          v-model="group.operator"
          :class="inputClass"
        >
          <option v-for="operator in GROUP_OPERATORS" :key="operator.value" :value="operator.value">
            {{ $t(operator.label) }}
          </option>
        </select>
      </label>
      <button
        v-if="removable"
        type="button"
        class="ms-auto rounded p-1.5 text-[var(--sh-muted)] hover:bg-red-50 hover:text-red-600"
        :aria-label="$t('Remove group')"
        @click="emit('remove')"
      >
        <CommonIcon name="trash3" size="xs" decorative />
      </button>
    </div>

    <p v-if="!group.children.length" class="text-sm text-[var(--sh-muted)]">
      {{ $t('No conditions yet.') }}
    </p>

    <ul class="flex flex-col gap-2">
      <!-- Conditions and groups are changed in place, so the children need no update events. -->
      <template v-for="child in group.children" :key="child.uid">
        <li v-if="isGroup(child)" class="list-none">
          <AutomationConditionGroup
            :model-value="child"
            :fields="fields"
            :id-prefix="idPrefix"
            removable
            @remove="remove(child.uid)"
          />
        </li>
        <AutomationConditionRow
          v-else
          :model-value="child"
          :field="fieldOf(child.key)"
          :id-prefix="idPrefix"
          @remove="remove(child.uid)"
        />
      </template>
    </ul>

    <div class="flex flex-wrap items-center gap-2">
      <label :for="`${idPrefix}-add-${group.uid}`">
        <span class="sr-only">{{ $t('Add a condition') }}</span>
        <select :id="`${idPrefix}-add-${group.uid}`" :class="inputClass" @change="addCondition">
          <option value="">{{ $t('+ Add a condition…') }}</option>
          <option v-for="field in fields" :key="field.key" :value="field.key">
            {{ $t(field.label) }}
          </option>
        </select>
      </label>
      <button
        type="button"
        class="h-8 rounded-lg border border-[var(--sh-line)] bg-white px-2 text-sm text-[var(--sh-ink)] hover:border-[var(--sh-app)]"
        @click="addGroup"
      >
        {{ $t('+ Add a group') }}
      </button>
    </div>
  </div>
</template>
