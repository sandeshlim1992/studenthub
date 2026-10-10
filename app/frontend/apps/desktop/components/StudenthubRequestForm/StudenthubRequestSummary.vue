<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, useId } from 'vue'

// Student Hub: the "Your request" card beside the student wizard's Details step (design D1 of
// https://claude.ai/artifact/UeLPcFJBkKoFFxhtektpDb): the steps taken so far, each with Change
// (back to that step), then Details as the current one. The admin page's preview shows it too.
const props = defineProps<{
  category: string
  subCategory: string
  campus: string
}>()

defineEmits<{
  change: [step: 1 | 2 | 3]
}>()

const headingId = useId()

const steps = computed(() => [
  { step: 1 as const, label: __('Category'), value: props.category, change: __('Change category') },
  {
    step: 2 as const,
    label: __('Request'),
    value: props.subCategory,
    change: __('Change request'),
  },
  { step: 3 as const, label: __('Campus'), value: props.campus, change: __('Change campus') },
])
</script>

<template>
  <aside
    class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5"
    :aria-labelledby="headingId"
    data-test-id="studenthub-request-summary"
  >
    <h3 :id="headingId" class="text-base font-bold text-slate-900">{{ $t('Your request') }}</h3>

    <ol class="flex flex-col">
      <li
        v-for="item in steps"
        :key="item.step"
        class="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3"
      >
        <div class="flex flex-col items-center">
          <span
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#15803d] text-white"
          >
            <CommonIcon name="check2" size="xs" decorative />
          </span>
          <span class="min-h-5 w-0.5 grow bg-emerald-300" aria-hidden="true" />
        </div>
        <div class="flex min-w-0 flex-col pt-0.5 pb-4">
          <span class="text-xs text-slate-500">{{ $t(item.label) }}</span>
          <span class="text-sm font-semibold break-words text-slate-900">{{ item.value }}</span>
        </div>
        <button
          type="button"
          class="h-11 cursor-pointer self-start rounded-lg px-2.5 text-sm font-semibold text-[#15803d] hover:bg-emerald-50"
          :aria-label="$t(item.change)"
          @click="$emit('change', item.step)"
        >
          {{ $t('Change') }}
        </button>
      </li>
      <li aria-current="step" class="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3">
        <span
          class="flex size-7 items-center justify-center rounded-full border-2 border-[#15803d] bg-emerald-50"
        >
          <span class="size-2.5 rounded-full bg-[#15803d]" />
        </span>
        <div class="flex flex-col pt-0.5">
          <span class="text-xs text-slate-500">{{ $t('Now') }}</span>
          <span class="text-sm font-bold text-emerald-800">{{ $t('Details') }}</span>
        </div>
      </li>
    </ol>

    <p class="border-t border-slate-100 pt-3 text-sm leading-relaxed text-slate-600">
      {{ $t('After you submit, we email you your ticket number.') }}
    </p>
  </aside>
</template>
