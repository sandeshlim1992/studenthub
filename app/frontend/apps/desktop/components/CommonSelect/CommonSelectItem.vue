<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, type ConcreteComponent } from 'vue'

import type { MatchedSelectOption, SelectOption } from '#shared/components/CommonSelect/types.ts'
import type { AutoCompleteOption } from '#shared/components/Form/fields/FieldAutocomplete/types'
import { i18n } from '#shared/i18n.ts'
import { useLocaleStore } from '#shared/stores/locale.ts'

const props = defineProps<{
  option: AutoCompleteOption | MatchedSelectOption | SelectOption
  selected?: boolean
  multiple?: boolean
  noLabelTranslate?: boolean
  filter?: string
  optionIconComponent?: ConcreteComponent
  noSelectionIndicator?: boolean
  noInteraction?: boolean
}>()

const emit = defineEmits<{
  select: [option: SelectOption]
  next: [{ option: AutoCompleteOption; noFocus?: boolean }]
}>()

const goToNextPage = (option: AutoCompleteOption, noFocus?: boolean) => {
  emit('next', { option, noFocus })
}

const selectOrGoToNextPage = (option: SelectOption, focus?: boolean) =>
  props.option.disabled ? goToNextPage(option as AutoCompleteOption, focus) : emit('select', option)

const label = computed(() => {
  const { option } = props

  if (props.noLabelTranslate && !option.labelPlaceholder)
    return option.label || option.value.toString()

  return i18n.t(option.label, ...(option.labelPlaceholder || [])) || option.value.toString()
})

const heading = computed(() => {
  const { option } = props

  if (props.noLabelTranslate && !(option as AutoCompleteOption).headingPlaceholder)
    return (option as AutoCompleteOption).heading

  return i18n.t(
    (option as AutoCompleteOption).heading,
    ...((option as AutoCompleteOption).headingPlaceholder || []),
  )
})

const OptionIconComponent = props.optionIconComponent

const locale = useLocaleStore()

const isStateOption = computed(() => {
  const str = String(props.option.label || props.option.value || '').toLowerCase()
  return (
    str === 'open' ||
    str === 'closed' ||
    str === 'new' ||
    str.includes('pending') ||
    str.includes('waiting') ||
    str.includes('resolved') ||
    str.includes('merged')
  )
})

const getStateStyle = (val: string | number | undefined) => {
  const str = String(val ?? '').toLowerCase()
  if (str.includes('closed') || str.includes('resolved') || str.includes('merged')) {
    return {
      type: 'closed',
      pillClass:
        'bg-[#f0fdf4] text-[#15803d] border border-emerald-200/90 shadow-2xs dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80',
      activeItemClass:
        'bg-emerald-50/90 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border-l-4 border-emerald-500',
      hoverItemClass:
        'hover:bg-emerald-50/60 hover:text-emerald-700 dark:hover:bg-emerald-950/30',
      dotClass: 'bg-emerald-500',
      icon: 'check2',
    }
  }
  if (str.includes('pending')) {
    return {
      type: 'pending',
      pillClass:
        'bg-[#fef9c3] text-[#854d0e] border border-yellow-200 shadow-2xs dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      activeItemClass:
        'bg-amber-50/90 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 font-bold border-l-4 border-amber-500',
      hoverItemClass:
        'hover:bg-amber-50/60 hover:text-amber-800 dark:hover:bg-amber-950/30',
      dotClass: 'bg-amber-500',
      icon: 'clock',
    }
  }
  if (str.includes('waiting')) {
    return {
      type: 'waiting',
      pillClass:
        'bg-[#fff7ed] text-[#c2410c] border border-orange-200 shadow-2xs dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
      activeItemClass:
        'bg-orange-50/90 text-orange-900 dark:bg-orange-950/60 dark:text-orange-300 font-bold border-l-4 border-orange-500',
      hoverItemClass:
        'hover:bg-orange-50/60 hover:text-orange-800 dark:hover:bg-orange-950/30',
      dotClass: 'bg-orange-500',
      icon: 'chat-left-dots',
    }
  }
  if (str.includes('new')) {
    return {
      type: 'new',
      pillClass:
        'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      activeItemClass:
        'bg-teal-50/90 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300 font-bold border-l-4 border-teal-500',
      hoverItemClass:
        'hover:bg-teal-50/60 hover:text-teal-700 dark:hover:bg-teal-950/30',
      dotClass: 'bg-teal-500',
      icon: 'sparkle',
    }
  }
  return {
    type: 'open',
    pillClass:
      'bg-[#e8f0f9] text-[#1e3a5f] border border-blue-200 shadow-2xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    activeItemClass:
      'bg-blue-50/90 text-[#1e3a5f] dark:bg-blue-950/60 dark:text-blue-300 font-bold border-l-4 border-[#1e3a5f]',
    hoverItemClass:
      'hover:bg-blue-50/60 hover:text-[#1e3a5f] dark:hover:bg-blue-950/30',
    dotClass: 'bg-[#1e3a5f] dark:bg-blue-400',
    icon: 'circle-fill',
  }
}
</script>

<template>
  <div
    :class="[
      isStateOption
        ? (selected ? getStateStyle(option.label || option.value).activeItemClass : getStateStyle(option.label || option.value).hoverItemClass)
        : {
            'hover:bg-blue-600 dark:hover:bg-blue-900': !option.disabled,
            'hover:bg-blue-800': option.disabled,
          },
      {
        'pointer-events-none': noInteraction,
        'my-1 rounded-lg transition-all': isStateOption,
      },
    ]"
    tabindex="0"
    :aria-selected="selected"
    :aria-description="option.disabled ? $t('This item expands to show more options') : undefined"
    class="group flex h-9 cursor-pointer items-center gap-1.5 self-stretch px-2.5 text-sm text-black outline-hidden focus-visible:shadow-[inset_0_0_0_1px_var(--color-blue-800)] dark:text-white"
    role="option"
    data-test-id="select-item"
    :data-value="option.value"
    @click="selectOrGoToNextPage(option, true)"
    @keypress.space.prevent="selectOrGoToNextPage(option)"
    @keypress.enter.prevent="selectOrGoToNextPage(option)"
  >
    <!-- Custom state option badge -->
    <template v-if="isStateOption">
      <div
        class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all shadow-2xs border"
        :class="getStateStyle(option.label || option.value).pillClass"
      >
        <span
          v-if="getStateStyle(option.label || option.value).type === 'open'"
          class="relative flex h-2 w-2 shrink-0"
        >
          <span
            v-if="selected"
            class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
          />
          <span class="relative inline-flex rounded-full h-2 w-2 bg-[#1e3a5f] dark:bg-blue-400" />
        </span>
        <CommonIcon
          v-else-if="getStateStyle(option.label || option.value).type === 'closed'"
          name="check2"
          size="xs"
          class="shrink-0 fill-current"
          decorative
        />
        <CommonIcon
          v-else-if="getStateStyle(option.label || option.value).type === 'pending'"
          name="clock"
          size="xs"
          class="shrink-0 fill-current"
          decorative
        />
        <span class="capitalize">{{ label }}</span>
      </div>
      <span class="grow" />
      <CommonIcon
        v-if="selected"
        class="shrink-0 fill-emerald-600 dark:fill-emerald-400"
        name="check2"
        size="xs"
        decorative
      />
    </template>

    <!-- Regular select option -->
    <template v-else>
      <CommonIcon
        v-if="multiple && !noSelectionIndicator"
        :class="{
          'fill-gray-100 group-hover:fill-black dark:fill-neutral-400 dark:group-hover:fill-white':
            !option.disabled,
          'fill-stone-200 group-hover:fill-white dark:fill-neutral-500': option.disabled,
        }"
        size="xs"
        decorative
        :name="selected ? 'check-square' : 'square'"
        class="m-0.5 shrink-0"
      />
      <CommonIcon
        v-else-if="!noSelectionIndicator"
        class="shrink-0 fill-gray-100 group-hover:fill-black dark:fill-neutral-400 dark:group-hover:fill-white"
        :class="{
          invisible: !selected,
          'fill-stone-200 group-hover:fill-white dark:fill-neutral-500': option.disabled,
        }"
        decorative
        size="tiny"
        name="check2"
      />
    <OptionIconComponent v-if="optionIconComponent" :option="option" />
    <CommonIcon
      v-else-if="option.icon"
      :name="option.icon"
      size="tiny"
      :class="{
        'fill-stone-200 group-hover:fill-white dark:fill-neutral-500': option.disabled,
      }"
      decorative
      class="shrink-0 fill-gray-100 group-hover:fill-black dark:fill-neutral-400 dark:group-hover:fill-white"
    />
    <div v-if="filter" v-tooltip="label + (heading ? ` – ${heading}` : '')" class="grow truncate">
      <!-- eslint-disable vue/no-v-html -->
      <span
        :class="{
          'text-stone-200 dark:text-neutral-500':
            option.disabled && !(option as AutoCompleteOption).children?.length,
          'text-gray-100 dark:text-neutral-400':
            option.disabled && (option as AutoCompleteOption).children?.length,
          'group-hover:text-white': option.disabled,
        }"
        v-html="(option as MatchedSelectOption).matchedLabel"
      />
      <span
        v-if="heading"
        class="text-stone-200 dark:text-neutral-500"
        :class="{
          'group-hover:text-black group-hover:dark:text-white': !option.disabled,
          'group-hover:text-white': option.disabled,
        }"
        >&nbsp;– {{ heading }}</span
      >
    </div>
    <span
      v-else
      v-tooltip="label + (heading ? ` – ${heading}` : '')"
      :class="{
        'text-stone-200 group-hover:text-white dark:text-neutral-500': option.disabled,
      }"
      class="grow truncate"
    >
      {{ label }}
      <span
        v-if="heading"
        class="text-stone-200 dark:text-neutral-500"
        :class="{
          'group-hover:text-black group-hover:dark:text-white': !option.disabled,
          'group-hover:text-white': option.disabled,
        }"
        >– {{ heading }}</span
      >
    </span>
    <div
      v-if="(option as AutoCompleteOption).children?.length"
      class="group/nav -me-2 shrink-0 flex-nowrap items-center justify-center gap-x-2.5 rounded-[5px] p-2.5"
      :aria-label="$t('Has submenu')"
      role="presentation"
    >
      <CommonIcon
        class="shrink-0 fill-blue-800!"
        :class="{ 'group-hover:fill-white!': option.disabled }"
        :name="locale.localeData?.dir === 'rtl' ? 'chevron-left' : 'chevron-right'"
        size="xs"
        decorative
      />
    </div>
    </template>
  </div>
</template>
