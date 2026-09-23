<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import {
  useDebounceFn,
  useElementBounding,
  useElementVisibility,
  useWindowSize,
} from '@vueuse/core'
import { escapeRegExp } from 'lodash-es'
import { useTemplateRef, computed, nextTick, onMounted, ref, toRef, watch } from 'vue'

import type { SelectOption } from '#shared/components/CommonSelect/types.ts'
import useValue from '#shared/components/Form/composables/useValue.ts'
import type { SelectContext } from '#shared/components/Form/fields/FieldSelect/types.ts'
import useSelectOptions from '#shared/composables/useSelectOptions.ts'
import useSelectPreselect from '#shared/composables/useSelectPreselect.ts'
import { useTrapTab } from '#shared/composables/useTrapTab.ts'
import { useFormBlock } from '#shared/form/useFormBlock.ts'
import { i18n } from '#shared/i18n.ts'
import stopEvent from '#shared/utils/events.ts'

import CommonInputSearch from '#desktop/components/CommonInputSearch/CommonInputSearch.vue'
import CommonSelect from '#desktop/components/CommonSelect/CommonSelect.vue'

interface Props {
  context: SelectContext & {
    alternativeBackground?: boolean
  }
}

const props = defineProps<Props>()

const contextReactive = toRef(props, 'context')

const { hasValue, valueContainer, currentValue, clearValue } = useValue(contextReactive)

const {
  sortedOptions,
  selectOption,
  getSelectedOption,
  getSelectedOptionIcon,
  getSelectedOptionLabel,
  setupMissingOrDisabledOptionHandling,
} = useSelectOptions(toRef(props.context, 'options'), contextReactive)

const inputElement = useTemplateRef('input')
const outputElement = useTemplateRef('output')
const filterInputElement = useTemplateRef('filter-input')
const selectInstance = useTemplateRef('select')

const filter = ref('')

const { activateTabTrap, deactivateTabTrap } = useTrapTab(inputElement, true)

const clearFilter = () => {
  filter.value = ''
}

watch(() => contextReactive.value.noFiltering, clearFilter)

const deaccent = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const filteredOptions = computed(() => {
  // Trim and de-accent search keywords and compile them as a case-insensitive regex.
  //   Make sure to escape special regex characters!
  const filterRegex = new RegExp(escapeRegExp(deaccent(filter.value.trim())), 'i')

  return sortedOptions.value
    .map(
      (option) =>
        ({
          ...option,

          // Match options via their de-accented labels.
          match: filterRegex.exec(deaccent(option.label || String(option.value))),
        }) as SelectOption,
    )
    .filter((option) => option.match)
})

const suggestedOptionLabel = computed(() => {
  if (!filter.value || !filteredOptions.value.length) return undefined

  const exactMatches = filteredOptions.value.filter(
    (option) =>
      (getSelectedOptionLabel(option.value) || option.value.toString())
        .toLowerCase()
        .indexOf(filter.value.toLowerCase()) === 0 &&
      (getSelectedOptionLabel(option.value) || option.value.toString()).length >
        filter.value.length,
  )

  if (!exactMatches.length) return undefined

  return getSelectedOptionLabel(exactMatches[0].value)
})

const inputElementBounds = useElementBounding(inputElement)
const isInputVisible = !!VITE_TEST_MODE || useElementVisibility(inputElement)
const windowSize = useWindowSize()

const isBelowHalfScreen = computed(() => {
  return inputElementBounds.y.value > windowSize.height.value / 2
})

const openSelectDropdown = () => {
  if (props.context.disabled) return
  if (!inputElement.value) return

  selectInstance.value?.openDropdown(inputElementBounds, windowSize.height)

  requestAnimationFrame(() => {
    activateTabTrap()
    if (props.context.noFiltering || (isStateSelect.value && sortedOptions.value.length <= 4)) {
      outputElement.value?.focus()
    } else {
      filterInputElement.value?.focus()
    }
  })
}

const isStateSelect = computed(() => props.context.node?.name === 'state_id')

const getStateStyle = (labelOrValue?: SelectValue | string) => {
  const str = (
    getSelectedOptionLabel(labelOrValue as SelectValue) ||
    String(labelOrValue ?? '')
  ).toLowerCase()

  if (str.includes('closed') || str.includes('resolved') || str.includes('merged')) {
    return {
      type: 'closed',
      label: getSelectedOptionLabel(labelOrValue as SelectValue) || i18n.t('Closed'),
      pillClass:
        'bg-[#f0fdf4] text-[#15803d] border border-emerald-200/90 shadow-2xs dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/80',
      activeButtonClass:
        'bg-[#15803d] text-white shadow-xs border-[#15803d]',
      inactiveButtonClass:
        'bg-white hover:bg-emerald-50/70 text-slate-600 hover:text-emerald-800 border-slate-200/90 hover:border-emerald-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white',
      dotClass: 'bg-emerald-500',
      icon: 'check2',
    }
  }
  if (str.includes('pending')) {
    return {
      type: 'pending',
      label: getSelectedOptionLabel(labelOrValue as SelectValue) || i18n.t('Pending'),
      pillClass:
        'bg-[#fef9c3] text-[#854d0e] border border-yellow-200 shadow-2xs dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
      activeButtonClass:
        'bg-amber-600 text-white shadow-xs border-amber-600',
      inactiveButtonClass:
        'bg-white hover:bg-amber-50/70 text-slate-600 hover:text-amber-800 border-slate-200/90 hover:border-amber-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white',
      dotClass: 'bg-amber-500',
      icon: 'clock',
    }
  }
  if (str.includes('waiting')) {
    return {
      type: 'waiting',
      label: getSelectedOptionLabel(labelOrValue as SelectValue) || i18n.t('Waiting for Reply'),
      pillClass:
        'bg-[#fff7ed] text-[#c2410c] border border-orange-200 shadow-2xs dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800',
      activeButtonClass:
        'bg-orange-600 text-white shadow-xs border-orange-600',
      inactiveButtonClass:
        'bg-white hover:bg-orange-50/70 text-slate-600 hover:text-orange-800 border-slate-200/90 hover:border-orange-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white',
      dotClass: 'bg-orange-500',
      icon: 'chat-left-dots',
    }
  }
  if (str.includes('new')) {
    return {
      type: 'new',
      label: getSelectedOptionLabel(labelOrValue as SelectValue) || i18n.t('New'),
      pillClass:
        'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800',
      activeButtonClass:
        'bg-teal-600 text-white shadow-xs border-teal-600',
      inactiveButtonClass:
        'bg-white hover:bg-teal-50/70 text-slate-600 hover:text-teal-800 border-slate-200/90 hover:border-teal-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white',
      dotClass: 'bg-teal-500',
      icon: 'sparkle',
    }
  }
  return {
    type: 'open',
    label: getSelectedOptionLabel(labelOrValue as SelectValue) || i18n.t('Open'),
    pillClass:
      'bg-[#e8f0f9] text-[#1e3a5f] border border-blue-200 shadow-2xs dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
    activeButtonClass:
      'bg-[#1e3a5f] text-white shadow-xs border-[#1e3a5f]',
    inactiveButtonClass:
      'bg-white hover:bg-blue-50/70 text-slate-600 hover:text-[#1e3a5f] border-slate-200/90 hover:border-blue-300 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:text-white',
    dotClass: 'bg-[#1e3a5f] dark:bg-blue-400',
    icon: 'circle-fill',
  }
}

onMounted(() => {
  if (props.context.autoOpenDropdown) openSelectDropdown()
})

const openOrMoveFocusToDropdown = (lastOption = false) => {
  if (!selectInstance.value?.isOpen) {
    return openSelectDropdown()
  }

  deactivateTabTrap()

  nextTick(() => {
    requestAnimationFrame(() => {
      selectInstance.value?.moveFocusToDropdown(lastOption)
    })
  })
}

const onCloseDropdown = () => {
  clearFilter()
  deactivateTabTrap()
}

const foldDropdown = (event: MouseEvent) => {
  if ((event?.target as HTMLElement)?.tagName !== 'INPUT' && selectInstance.value) {
    selectInstance.value.closeDropdown()

    return onCloseDropdown()
  }
}

const handleToggleDropdown = (event: MouseEvent) => {
  if (selectInstance.value?.isOpen) return foldDropdown(event)
  openSelectDropdown()
}

const handleCloseDropdown = (
  event: KeyboardEvent,
  expanded: boolean,
  closeDropdown: () => void,
) => {
  if (expanded) {
    stopEvent(event)
    closeDropdown()
  }
}

useFormBlock(
  contextReactive,
  useDebounceFn((event) => {
    if (selectInstance.value?.isOpen) foldDropdown(event)
    openSelectDropdown()
  }, 500),
)

useSelectPreselect(sortedOptions, contextReactive)
setupMissingOrDisabledOptionHandling()
</script>

<template>
  <div
    ref="input"
    class="flex h-auto min-h-10 transition-all duration-150"
    :class="[
      context.classes.input,
      isStateSelect
        ? 'bg-white dark:bg-neutral-800 border-2 border-slate-200/90 dark:border-neutral-700 hover:border-[#1e3a5f] shadow-2xs'
        : 'bg-blue-200 hover:outline-1 hover:-outline-offset-1 hover:outline-blue-600 has-[output:focus,input:focus]:outline-1 has-[output:focus,input:focus]:-outline-offset-1 has-[output:focus,input:focus]:outline-blue-800 dark:bg-gray-700 dark:hover:outline-blue-900 dark:has-[output:focus,input:focus]:outline-blue-800 formkit-alternative-background:bg-neutral-50 dark:formkit-alternative-background:bg-gray-500',
      {
        'rounded-xl': isStateSelect && !selectInstance?.isOpen,
        'rounded-lg': !isStateSelect && !selectInstance?.isOpen,
        'rounded-t-xl': isStateSelect && selectInstance?.isOpen && !isBelowHalfScreen,
        'rounded-t-lg': !isStateSelect && selectInstance?.isOpen && !isBelowHalfScreen,
        'rounded-b-xl': isStateSelect && selectInstance?.isOpen && isBelowHalfScreen,
        'rounded-b-lg': !isStateSelect && selectInstance?.isOpen && isBelowHalfScreen,
      },
    ]"
    data-test-id="field-select"
  >
    <CommonSelect
      ref="select"
      #default="{ state: expanded, close: closeDropdown }"
      :model-value="currentValue"
      :options="filteredOptions"
      :multiple="context.multiple"
      :owner="context.id"
      :filter="filter"
      :is-target-visible="isInputVisible"
      no-options-label-translation
      no-close
      passive
      @select="selectOption"
      @close="onCloseDropdown"
    >
      <!-- eslint-disable vuejs-accessibility/interactive-supports-focus-->
      <output
        :id="context.id"
        ref="output"
        role="combobox"
        aria-controls="common-select"
        aria-owns="common-select"
        aria-haspopup="menu"
        :aria-expanded="expanded"
        :name="context.node.name"
        class="flex grow items-center gap-2.5 px-2.5 py-2 text-black focus:outline-hidden dark:text-white formkit-disabled:pointer-events-none"
        :aria-labelledby="`label-${context.id}`"
        :aria-disabled="context.disabled"
        :data-multiple="context.multiple"
        :aria-describedby="context.describedBy"
        :tabindex="expanded && !context.noFiltering ? '-1' : '0'"
        v-bind="context.attrs"
        @keydown.escape="handleCloseDropdown($event, expanded, closeDropdown)"
        @keypress.enter.prevent="openSelectDropdown()"
        @keydown.down.prevent="openOrMoveFocusToDropdown()"
        @keydown.up.prevent="openOrMoveFocusToDropdown(true)"
        @keypress.space.prevent="openSelectDropdown()"
        @blur="context.handlers.blur"
        @click.stop="handleToggleDropdown"
      >
        <div
          v-if="hasValue && context.multiple"
          class="select-scroll-shadows flex flex-wrap gap-1.5 overflow-y-auto outline-hidden"
          :class="{
            'select-scroll-shadows--base': !context.alternativeBackground,
            'select-scroll-shadows--alt': context.alternativeBackground,
            'max-w-1/2 shrink-0': expanded,
          }"
          role="list"
        >
          <div
            v-for="selectedValue in valueContainer"
            :key="selectedValue"
            class="flex items-center gap-1.5"
            role="listitem"
          >
            <div
              class="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-xs text-black dark:bg-gray-200 dark:text-white formkit-alternative-background:bg-neutral-100 dark:formkit-alternative-background:bg-gray-200"
            >
              <CommonIcon
                v-if="getSelectedOptionIcon(selectedValue)"
                :name="getSelectedOptionIcon(selectedValue)"
                class="shrink-0 fill-gray-100 dark:fill-neutral-400"
                size="xs"
                decorative
              />
              <span
                v-tooltip="
                  getSelectedOptionLabel(selectedValue) || i18n.t('%s (unknown)', selectedValue)
                "
                class="line-clamp-3 break-word"
              >
                {{ getSelectedOptionLabel(selectedValue) || i18n.t('%s (unknown)', selectedValue) }}
              </span>
              <CommonIcon
                :aria-label="i18n.t('Unselect option')"
                class="shrink-0 fill-stone-200 hover:fill-black focus-visible:rounded-xs focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-blue-800 dark:fill-neutral-500 dark:hover:fill-white"
                name="x-lg"
                size="xs"
                role="button"
                tabindex="0"
                @click.stop="selectOption(getSelectedOption(selectedValue))"
                @keypress.enter.prevent.stop="selectOption(getSelectedOption(selectedValue))"
                @keypress.space.prevent.stop="selectOption(getSelectedOption(selectedValue))"
              />
            </div>
          </div>
        </div>
        <CommonInputSearch
          v-if="expanded && !context.noFiltering && (!isStateSelect || sortedOptions.length > 4)"
          ref="filter-input"
          v-model="filter"
          :suggestion="suggestedOptionLabel"
          :alternative-background="context.alternativeBackground"
          @keypress.space.stop
        />
        <div v-else class="flex grow flex-wrap gap-1" role="list">
          <div
            v-if="hasValue && !context.multiple"
            class="flex items-center gap-1.5 text-sm"
            role="listitem"
          >
            <!-- Rich status pill for state_id -->
            <div
              v-if="isStateSelect"
              class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all duration-150"
              :class="getStateStyle(currentValue).pillClass"
            >
              <span
                v-if="getStateStyle(currentValue).type === 'open'"
                class="relative flex h-2 w-2 shrink-0"
              >
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span class="relative inline-flex rounded-full h-2 w-2 bg-[#1e3a5f] dark:bg-blue-400" />
              </span>
              <CommonIcon
                v-else-if="getStateStyle(currentValue).type === 'closed'"
                name="check2"
                size="xs"
                class="shrink-0 fill-current"
                decorative
              />
              <CommonIcon
                v-else-if="getStateStyle(currentValue).type === 'pending'"
                name="clock"
                size="xs"
                class="shrink-0 fill-current"
                decorative
              />
              <span class="capitalize">{{ getStateStyle(currentValue).label }}</span>
            </div>

            <!-- Standard select option rendering -->
            <template v-else>
              <CommonIcon
                v-if="getSelectedOptionIcon(currentValue)"
                :name="getSelectedOptionIcon(currentValue)"
                class="shrink-0 fill-gray-100 dark:fill-neutral-400"
                size="tiny"
                decorative
              />
              <span
                v-tooltip="
                  getSelectedOptionLabel(currentValue) || i18n.t('%s (unknown)', currentValue)
                "
                class="line-clamp-3 break-word"
              >
                {{ getSelectedOptionLabel(currentValue) || i18n.t('%s (unknown)', currentValue) }}
              </span>
            </template>
          </div>
        </div>
        <CommonIcon
          v-if="context.clearable && hasValue && !context.disabled"
          :aria-label="i18n.t('Clear selection')"
          class="shrink-0 fill-stone-200 hover:fill-black focus:outline-transparent focus-visible:rounded-xs focus-visible:outline-1 focus-visible:outline-offset-1 focus-visible:outline-blue-800 dark:fill-neutral-500 dark:hover:fill-white"
          name="x-lg"
          size="xs"
          role="button"
          tabindex="0"
          @click.stop="clearValue()"
          @keypress.enter.prevent.stop="clearValue()"
          @keypress.space.prevent.stop="clearValue()"
        />
        <CommonIcon
          class="shrink-0 fill-stone-200 dark:fill-neutral-500"
          name="chevron-down"
          size="xs"
          decorative
        />
      </output>
    </CommonSelect>
  </div>
</template>
