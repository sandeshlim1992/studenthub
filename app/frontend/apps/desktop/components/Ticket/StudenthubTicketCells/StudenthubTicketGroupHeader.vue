<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import CommonUserAvatar from '#shared/components/CommonUserAvatar/CommonUserAvatar.vue'
import ObjectAttributeContent from '#shared/components/ObjectAttributes/ObjectAttribute.vue'
import type { ObjectAttribute } from '#shared/entities/object-attributes/types/store.ts'
import type { TicketByList } from '#shared/entities/ticket/types.ts'
import { getIdFromGraphQLId } from '#shared/graphql/utils.ts'
import { SYSTEM_USER_INTERNAL_ID } from '#shared/utils/constants.ts'

import type { TableAttribute } from '#desktop/components/CommonTable/types.ts'
import { escalationStatus, STUDENTHUB_STATE_TONES } from '#desktop/utils/studenthubTicketList.ts'

import { useStudenthubNow } from './useStudenthubNow.ts'

// Student Hub: header of one group in a grouped ticket list: the agent's avatar (grouped by
// owner), the name, how many tickets and how many of the loaded ones are overdue. The pinned
// group (Unassigned in the Teams views) gets a dashed circle and a tinted band.
interface Props {
  item: TicketByList
  attribute: TableAttribute
  tickets: TicketByList[]
  count: number
  complete: boolean
  label?: string
}

const props = defineProps<Props>()

const now = useStudenthubNow()

const owner = computed(() => {
  if (props.label || props.attribute.name !== 'owner_id') return null

  const { owner } = props.item
  if (!owner?.id || getIdFromGraphQLId(owner.id) === SYSTEM_USER_INTERNAL_ID) return null

  return owner
})

const overdue = computed(
  () =>
    props.tickets.filter(
      (ticket) =>
        escalationStatus(ticket.escalationAt, now.value.getTime(), 0).status === 'overdue',
    ).length,
)

const countTone = STUDENTHUB_STATE_TONES.grey
const overdueTone = STUDENTHUB_STATE_TONES.red
</script>

<template>
  <div class="sh-ticket-group" :data-pinned="label ? 'true' : undefined">
    <span v-if="label" class="sh-ticket-group__unassigned" aria-hidden="true" />
    <CommonUserAvatar v-else-if="owner" :entity="owner" size="xs" decorative />
    <span class="sh-ticket-group__name">
      <template v-if="label">{{ $t(label) }}</template>
      <ObjectAttributeContent
        v-else
        mode="table"
        :attribute="attribute as unknown as ObjectAttribute"
        :object="item"
      />
    </span>
    <span
      class="sh-ticket-group__count"
      :style="{ backgroundColor: countTone.background, color: countTone.text }"
    >
      {{ count }}{{ complete ? '' : '+' }}
    </span>
    <span v-if="overdue" class="sh-ticket-group__overdue" :style="{ color: overdueTone.text }">
      {{ $t('%s overdue', overdue) }}
    </span>
  </div>
</template>
