<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import type { ObjectLike } from '#shared/types/utils.ts'

import CommonActionMenu from '#desktop/components/CommonActionMenu/CommonActionMenu.vue'
import type { MenuItem } from '#desktop/components/CommonPopoverMenu/types.ts'
import { useScrollPosition } from '#desktop/composables/useScrollPosition.ts'

import { STUDENTHUB_SIDE_PANEL_KEY } from './studenthubSidePanel.ts'

interface Props {
  title: string
  titleClass?: string
  icon: string
  iconClass?: string
  entity?: ObjectLike
  actions?: MenuItem[]
}

withDefaults(defineProps<Props>(), {
  titleClass: '',
  iconClass: 'text-stone-200 dark:text-neutral-500',
})

const scrollPosition = defineModel<number>({
  required: true,
  default: 0,
})

const scrollContainer = useTemplateRef('scroll-container')

// Student Hub: under the agents' panel tabs the tab names the panel, so the title is only read
// out; the panel's menu (⋮) stays at the top right.
const sidePanel = inject(STUDENTHUB_SIDE_PANEL_KEY, null)
const isUnderTabs = computed(() => !!sidePanel?.tabs.value)

// Handle scroll position (re)storing of the active sidebar, when navigating between taskbar tabs.
useScrollPosition(scrollContainer)

// Handle scroll position (re)storing, when switching between different sidebars.
onMounted(() => {
  if (!scrollContainer?.value) return
  scrollContainer.value.scrollTop = scrollPosition.value
})

onBeforeUnmount(() => {
  if (!scrollContainer?.value) return
  scrollPosition.value = scrollContainer.value.scrollTop
})
</script>

<template>
  <div
    class="flex w-full gap-2"
    :class="isUnderTabs ? ['justify-end px-3', actions ? 'pt-2' : 'h-0'] : 'p-3'"
  >
    <CommonLabel
      tag="h2"
      class="min-h-7 grow gap-1.5"
      :class="[titleClass, { 'sr-only': isUnderTabs }]"
      size="large"
      :prefix-icon="icon"
      :icon-color="iconClass"
    >
      {{ $t(title) }}
    </CommonLabel>

    <CommonActionMenu
      v-if="actions"
      class="text-gray-100 dark:text-neutral-400"
      no-single-action-mode
      placement="arrowEnd"
      :entity="entity"
      :actions="actions"
    />
  </div>

  <div ref="scroll-container" class="flex h-full flex-col gap-3 overflow-y-auto p-3">
    <slot />
  </div>
</template>
