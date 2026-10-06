<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { i18n } from '#shared/i18n.ts'

// Student Hub: "SLA for this priority" on the New ticket screen: the SLA the ticket would get
// with the chosen priority, team and state (GET /api/v1/studenthub/sla_preview).
interface Props {
  priorityId?: string | number | null
  groupId?: string | number | null
  stateId?: string | number | null
}

interface Preview {
  status: 'match' | 'none' | 'unknown'
  sla: {
    name: string
    first_response_time: number | null
    update_time: number | null
    solution_time: number | null
    calendar: string | null
  } | null
}

const props = defineProps<Props>()

const preview = ref<Preview | null>(null)

// The form fills in several values at once: only the answer to the latest request counts.
let latestRequest = 0

const load = () => {
  latestRequest += 1
  const request = latestRequest

  const query = new URLSearchParams()
  if (props.priorityId) query.set('priority_id', String(props.priorityId))
  if (props.groupId) query.set('group_id', String(props.groupId))
  if (props.stateId) query.set('state_id', String(props.stateId))

  // fetch can throw at once (tests), so start it inside the promise chain.
  Promise.resolve()
    .then(() =>
      fetch(`/api/v1/studenthub/sla_preview?${query}`, {
        credentials: 'same-origin',
        headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      }),
    )
    .then((response) => (response.ok ? response.json() : null))
    .then((data: Preview | null) => {
      if (request === latestRequest) preview.value = data
    })
    .catch(() => {
      if (request === latestRequest) preview.value = null
    })
}

watch(() => [props.priorityId, props.groupId, props.stateId], load, { immediate: true })

// SLA times are minutes of the calendar's working time.
const duration = (minutes: number | null) => {
  if (!minutes) return null
  if (minutes % 60 !== 0) return i18n.t('%s working minutes', minutes)
  const hours = minutes / 60
  return hours === 1 ? i18n.t('1 working hour') : i18n.t('%s working hours', hours)
}

const rows = computed(() => {
  const sla = preview.value?.sla
  if (!sla) return []

  return [
    { label: __('First response'), value: duration(sla.first_response_time) },
    { label: __('Update'), value: duration(sla.update_time) },
    { label: __('Resolution'), value: duration(sla.solution_time) },
  ].filter((row) => row.value)
})
</script>

<template>
  <div class="sh-sla-preview" aria-live="polite">
    <template v-if="preview?.status === 'match' && preview.sla">
      <dl v-if="rows.length" class="sh-sla-preview__rows">
        <template v-for="row in rows" :key="row.label">
          <dt>{{ $t(row.label) }}</dt>
          <dd>{{ row.value }}</dd>
        </template>
      </dl>
      <p class="sh-sla-preview__note">
        {{
          preview.sla.calendar
            ? $t('%s · business hours of %s. The clock starts when the ticket is created.', preview.sla.name, preview.sla.calendar)
            : $t('%s. The clock starts when the ticket is created.', preview.sla.name)
        }}
      </p>
    </template>
    <p v-else-if="preview?.status === 'none'" class="sh-sla-preview__note">
      {{ $t('No SLA applies with this priority.') }}
    </p>
    <p v-else-if="preview?.status === 'unknown'" class="sh-sla-preview__note">
      {{ $t('The SLA depends on details known only once the ticket exists.') }}
    </p>
    <p v-else class="sh-sla-preview__note">{{ $t('Choose a priority to see its SLA.') }}</p>
  </div>
</template>
