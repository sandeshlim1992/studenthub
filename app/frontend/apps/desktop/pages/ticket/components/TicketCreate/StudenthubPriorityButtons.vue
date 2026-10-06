<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useId } from 'vue'

import { i18n } from '#shared/i18n.ts'

import { priorityLevelFor, STUDENTHUB_PRIORITY_STYLES } from '#desktop/utils/studenthubTicketList.ts'

// Student Hub: the ticket priority as buttons on the New ticket screen ("P1 - Critical" shows as
// "Critical" in its level colour). Drives Zammad's own Priority field, which stays in the form
// (hidden) so its options, default and validation keep coming from Zammad. The "None" priority
// (no priority yet, the default here) gets no button: then no button is pressed.
interface Option {
  value: string | number
  label: string
  disabled?: boolean
}

interface Props {
  label: string
  options?: Option[]
  value?: string | number | null
  onSelect: (value: string | number) => void
}

const props = defineProps<Props>()

const labelId = useId()

const buttons = computed(() =>
  (props.options ?? [])
    .filter((option) => !option.disabled && option.label.trim().toLowerCase() !== 'none')
    .map((option) => {
      const label = i18n.t(option.label)
      const level = priorityLevelFor(label)
      return {
        value: option.value,
        // "P1  - Critical" → "Critical"; other names stay as they are.
        text: label.replace(/^\s*P\s*[1-4]\s*-\s*/i, '') || label,
        title: label,
        color: STUDENTHUB_PRIORITY_STYLES[level].color,
        // The value comes back as a number or a string.
        selected: String(option.value) === String(props.value),
      }
    }),
)
</script>

<template>
  <div class="sh-priority">
    <span :id="labelId" class="sh-priority__label">{{ $t(label) }}</span>
    <div class="sh-priority__buttons" role="group" :aria-labelledby="labelId">
      <button
        v-for="button in buttons"
        :key="button.value"
        type="button"
        class="sh-priority__button"
        :class="{ 'sh-priority__button--selected': button.selected }"
        :style="{ '--sh-priority-color': button.color }"
        :aria-pressed="button.selected"
        :title="button.title"
        @click="onSelect(button.value)"
      >
        {{ button.text }}
      </button>
    </div>
  </div>
</template>
