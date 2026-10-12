<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { groupToRows, rowsToGroup, type ConditionField, type ConditionState } from './automation.ts'
import AutomationConditionEditor from './AutomationConditionEditor.vue'
import AutomationConditionGroup from './AutomationConditionGroup.vue'

// The conditions of a record: a plain list (all must match, each field once) or, in expert mode,
// groups of which all, any or none must match. Expert mode can be switched on while Zammad allows
// it (setting ticket_allow_expert_conditions), and off while the groups still fit a plain list.

const props = defineProps<{ fields: ConditionField[]; idPrefix: string; allowExpert?: boolean }>()

const state = defineModel<ConditionState>({ required: true })

const backToList = computed(() => (state.value.group ? groupToRows(state.value.group) : null))

const showSwitch = computed(() => (state.value.group ? true : props.allowExpert))

const expert = computed({
  get: () => Boolean(state.value.group),
  set: (on: boolean) => {
    if (on) {
      state.value = { rows: [], group: rowsToGroup(state.value.rows) }
      return
    }
    if (backToList.value) state.value = { rows: backToList.value, group: null }
  },
})
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-if="showSwitch" class="flex flex-wrap items-center gap-2">
      <label
        :for="`${idPrefix}-expert`"
        class="flex items-center gap-2 text-sm text-[var(--sh-ink)]"
      >
        <input
          :id="`${idPrefix}-expert`"
          v-model="expert"
          type="checkbox"
          :disabled="expert && !backToList"
        />
        {{ $t('Expert mode (groups with all / any / none, a field more than once)') }}
      </label>
      <span v-if="expert && !backToList" class="text-xs text-[var(--sh-muted)]">
        {{
          $t('To switch it off, keep one "all of these" group without groups or repeated fields.')
        }}
      </span>
    </div>

    <AutomationConditionGroup
      v-if="state.group"
      v-model="state.group"
      :fields="fields"
      :id-prefix="idPrefix"
    />
    <AutomationConditionEditor v-else v-model="state.rows" :fields="fields" :id-prefix="idPrefix" />
  </div>
</template>
