<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { EnumTicketStateColorCode } from '#shared/graphql/types.ts'

import CommonTicketStateIndicatorIcon from './CommonTicketStateIndicatorIcon.vue'

export interface Props {
  colorCode: EnumTicketStateColorCode
  label: string
}

const props = defineProps<Props>()

const badgeVariant = computed(() => {
  switch (props.colorCode) {
    case EnumTicketStateColorCode.Closed:
      return 'success'
    case EnumTicketStateColorCode.Pending:
      return 'tertiary'
    case EnumTicketStateColorCode.Escalating:
      return 'danger'
    case EnumTicketStateColorCode.Open:
    default:
      return 'warning'
  }
})

const stateCustomClasses = computed(() => {
  const lbl = (props.label || '').toLowerCase()
  if (
    props.colorCode === EnumTicketStateColorCode.Closed ||
    lbl.includes('closed') ||
    lbl.includes('resolved') ||
    lbl.includes('merged')
  ) {
    return 'bg-[#e6eee8]! text-[#243d2c]! border! border-[#b8d5c0]! dark:bg-[#18261e]! dark:text-[#a3ccae]! dark:border-[#2f4f38]!'
  }
  if (props.colorCode === EnumTicketStateColorCode.Pending || lbl.includes('pending')) {
    return 'bg-purple-50! text-purple-900! border! border-purple-200/80! border-l-2! border-l-purple-500! dark:bg-purple-950/40! dark:text-purple-200! dark:border-purple-800/70! dark:border-l-purple-500!'
  }
  if (lbl.includes('waiting')) {
    return 'bg-amber-50! text-amber-900! border! border-amber-200/80! border-l-2! border-l-amber-500! dark:bg-amber-950/40! dark:text-amber-200! dark:border-amber-800/70! dark:border-l-amber-500!'
  }
  if (lbl.includes('new')) {
    return 'bg-[#ecfdf5]! text-[#065f46]! border! border-[#a7f3d0]! border-l-2! border-l-[#22c55e]! dark:bg-emerald-950/50! dark:text-emerald-200! dark:border-emerald-800/80! dark:border-l-[#22c55e]!'
  }
  // Open / default
  return 'bg-sky-50! text-sky-900! border! border-sky-200/80! border-l-2! border-l-sky-500! dark:bg-sky-950/40! dark:text-sky-200! dark:border-sky-800/70! dark:border-l-sky-500!'
})
</script>

<template>
  <CommonBadge
    :variant="badgeVariant"
    role="group"
    rounded
    class="uppercase tracking-wider font-extrabold shadow-2xs transition-all inline-flex items-center px-3 py-1 text-xs"
    :class="stateCustomClasses"
  >
    <CommonTicketStateIndicatorIcon
      class="ltr:mr-1.5 rtl:ml-1.5 shrink-0"
      :color-code="props.colorCode"
      :label="label"
    />
    <span>{{ $t(label) }}</span>
  </CommonBadge>
</template>
