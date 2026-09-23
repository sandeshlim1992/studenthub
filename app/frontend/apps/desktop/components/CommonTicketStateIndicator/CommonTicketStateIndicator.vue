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
    return 'bg-[#f0fdf4]! text-[#15803d]! border! border-emerald-200/90! dark:bg-emerald-950/40! dark:text-emerald-300! dark:border-emerald-800/80!'
  }
  if (props.colorCode === EnumTicketStateColorCode.Pending || lbl.includes('pending')) {
    return 'bg-[#fef9c3]! text-[#854d0e]! border! border-yellow-200/90! dark:bg-amber-950/40! dark:text-amber-300! dark:border-amber-800/80!'
  }
  if (lbl.includes('waiting')) {
    return 'bg-[#fff7ed]! text-[#c2410c]! border! border-orange-200/90! dark:bg-orange-950/40! dark:text-orange-300! dark:border-orange-800/80!'
  }
  if (lbl.includes('new')) {
    return 'bg-emerald-50! text-emerald-700! border! border-emerald-200/90! dark:bg-teal-950/40! dark:text-teal-300! dark:border-teal-800/80!'
  }
  // Open / default
  return 'bg-[#e8f0f9]! text-[#1e3a5f]! border! border-blue-200/90! dark:bg-blue-950/40! dark:text-blue-300! dark:border-blue-800/80!'
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
