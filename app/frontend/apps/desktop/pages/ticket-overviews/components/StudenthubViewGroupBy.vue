<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { NotificationTypes } from '#shared/components/CommonNotifications/types.ts'
import { useNotifications } from '#shared/components/CommonNotifications/useNotifications.ts'
import { i18n } from '#shared/i18n.ts'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import CommonDropdown from '#desktop/components/CommonDropdown/CommonDropdown.vue'
import type { DropdownItem } from '#desktop/components/CommonDropdown/types.ts'

import {
  loadStudenthubViewChoice,
  resetStudenthubViewChoice,
  saveStudenthubViewGrouping,
  type StudenthubViewChoice,
} from '../composables/studenthubViewChoice.ts'

// Student Hub: "Group by" above a ticket view. The agent's choice is kept per view on the
// server; "Reset" goes back to the view's own grouping (Teams views: by agent).
interface Props {
  overviewId: string
}

const props = defineProps<Props>()

const NONE = '__none__'

const choice = ref<StudenthubViewChoice | null>(null)
const isSaving = ref(false)

let latestRequest = 0

watch(
  () => props.overviewId,
  (overviewId) => {
    latestRequest += 1
    const request = latestRequest
    choice.value = null

    loadStudenthubViewChoice(overviewId)
      .then((data) => {
        if (request === latestRequest) choice.value = data
      })
      .catch(() => {
        if (request === latestRequest) choice.value = null
      })
  },
  { immediate: true },
)

const items = computed<DropdownItem[]>(() => [
  { key: NONE, label: __('No grouping') },
  ...(choice.value?.grouping_options ?? []).map((option) => ({ key: option.value, label: option.label })),
])

const selected = computed<DropdownItem | undefined>({
  get: () => items.value.find((item) => item.key === (choice.value?.group_by || NONE)),
  set: (item) => {
    if (item) change(item.key === NONE ? '' : item.key)
  },
})

const { notify } = useNotifications()

const run = async (action: () => Promise<StudenthubViewChoice>) => {
  isSaving.value = true
  try {
    choice.value = await action()
  } catch (error) {
    notify({
      id: 'studenthub-view-group-by',
      type: NotificationTypes.Error,
      message: __('The grouping could not be changed (%s).'),
      messagePlaceholder: [error instanceof Error ? error.message : String(error)],
    })
  } finally {
    isSaving.value = false
  }
}

const change = (groupBy: string) => {
  if (groupBy === choice.value?.group_by) return
  run(() => saveStudenthubViewGrouping(props.overviewId, groupBy))
}

const reset = () => run(() => resetStudenthubViewChoice(props.overviewId))

const buttonLabel = computed(() =>
  i18n.t('Group by: %s', selected.value ? i18n.t(selected.value.label) : i18n.t('No grouping')),
)
</script>

<template>
  <div v-if="choice" class="sh-view-group-by">
    <span class="sh-view-group-by__label" aria-hidden="true">{{ $t('Group by') }}</span>
    <CommonDropdown
      v-model="selected"
      class="sh-view-group-by__button"
      :items="items"
      :aria-label="buttonLabel"
      :disabled="isSaving"
    />
    <CommonButton
      v-if="choice.customised"
      class="sh-view-group-by__reset"
      size="small"
      variant="tertiary"
      :disabled="isSaving"
      @click="reset"
    >
      {{ $t('Reset') }}
    </CommonButton>
  </div>
</template>
