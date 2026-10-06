<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { i18n } from '#shared/i18n.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import {
  escalationStatus,
  escalationWarningMinutes,
  formatEscalationDuration,
  STUDENTHUB_STATE_TONES,
} from '#desktop/utils/studenthubTicketList.ts'

import { useStudenthubNow } from './useStudenthubNow.ts'

// Student Hub: time left until the SLA deadline. Red once it has passed, amber when it is
// closer than the admin's "due soon" point (Branding), grey otherwise.
interface Props {
  value?: string | null
}

const props = defineProps<Props>()

const config = toRef(useApplicationStore(), 'config')
const now = useStudenthubNow()

const escalation = computed(() =>
  escalationStatus(
    props.value,
    now.value.getTime(),
    escalationWarningMinutes(config.value.studenthub_escalation_warning_minutes),
  ),
)

const label = computed(() => {
  const { status, minutes } = escalation.value
  if (status === 'none') return '-'

  const duration = formatEscalationDuration(minutes, (text, ...args) => i18n.t(text, ...args))
  return status === 'overdue' ? i18n.t('overdue %s', duration) : i18n.t('due in %s', duration)
})

const chip = computed(() => {
  if (escalation.value.status === 'overdue') return STUDENTHUB_STATE_TONES.red
  if (escalation.value.status === 'soon') return STUDENTHUB_STATE_TONES.amber
  return null
})

const tooltip = computed(() => (props.value ? i18n.dateTime(props.value) : undefined))
</script>

<template>
  <span
    v-if="chip"
    v-tooltip="tooltip"
    class="inline-flex max-w-full items-center rounded px-2 py-0.5 text-xs font-semibold tabular-nums"
    :style="{ backgroundColor: chip.background, color: chip.text }"
    :data-status="escalation.status"
  >
    <span class="truncate">{{ label }}</span>
  </span>
  <span
    v-else
    v-tooltip="tooltip"
    class="block truncate text-sm text-gray-100 tabular-nums group-hover:text-black! group-focus-visible:text-white! group-active:text-white!"
    :data-status="escalation.status"
  >
    {{ label }}
  </span>
</template>
