<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { useApplicationStore } from '#shared/stores/application.ts'

import { STUDENTHUB_STATE_TONES, stateToneFor } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: ticket state as a coloured label; the colour per state is an admin setting.
interface Props {
  state: { id: string; name: string; stateType?: { name?: string | null } | null }
}

const props = defineProps<Props>()

const config = toRef(useApplicationStore(), 'config')

const tone = computed(() => {
  const key = stateToneFor(
    getIdFromGraphQLId(props.state.id),
    props.state.stateType?.name,
    config.value.studenthub_ticket_state_colors,
  )
  return { key, ...STUDENTHUB_STATE_TONES[key] }
})
</script>

<template>
  <span
    class="inline-flex max-w-full items-center rounded px-2 py-0.5 text-xs font-semibold"
    :style="{ backgroundColor: tone.background, color: tone.text }"
    :data-tone="tone.key"
  >
    <span class="truncate">{{ $t(state.name) }}</span>
  </span>
</template>
