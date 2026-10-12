<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import ObjectAttributeContent from '#shared/components/ObjectAttributes/ObjectAttribute.vue'
import type { ObjectAttribute } from '#shared/entities/object-attributes/types/store.ts'

import CommonDivider from '#desktop/components/CommonDivider/CommonDivider.vue'

import type { TableAttribute, TableItem } from './types'

export interface Props {
  item: TableItem
  attribute: TableAttribute
  tableColumnLength: number
  groupByValueIndex: number
  groupByRowCounts: string[][] | undefined
  remainingItems: number
  // Student Hub: a fixed label instead of the attribute value (pinned group).
  label?: string
}

const props = defineProps<Props>()

const groupItemIds = computed(() => props.groupByRowCounts?.[props.groupByValueIndex] ?? [])

const groupByRowCount = computed(() => {
  return props.groupByRowCounts?.[props.groupByValueIndex].length
})

const completedGroup = computed(() => {
  if (props.remainingItems === 0) return true

  return props.groupByValueIndex !== (props.groupByRowCounts?.length || 0) - 1
})
</script>

<template>
  <tr class="group">
    <td :colspan="tableColumnLength">
      <CommonDivider class="mt-2 mb-1 group-first:mt-0" />
      <!-- Student Hub: a list can draw its own group header (TicketListTable). -->
      <slot
        :item="item"
        :attribute="attribute"
        :item-ids="groupItemIds"
        :count="groupByRowCount ?? 0"
        :complete="completedGroup"
        :label="label"
      >
        <div class="h-10 p-2.5">
          <CommonLabel class="cursor-default truncate text-stone-200! dark:text-neutral-500!">
            <template v-if="label">{{ $t(label) }}</template>
            <ObjectAttributeContent
              v-else
              mode="table"
              :attribute="attribute as unknown as ObjectAttribute"
              :object="item"
            />
            <CommonBadge class="ms-0.5 leading-snug font-bold" rounded size="xs" variant="info">
              {{ groupByRowCount }}{{ completedGroup ? '' : '+' }}
            </CommonBadge>
          </CommonLabel>
        </div>
      </slot>
    </td>
  </tr>
</template>
