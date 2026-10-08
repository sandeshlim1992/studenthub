<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, inject } from 'vue'

import CommonUpdateIndicator from '#desktop/components/CommonUpdateIndicator/CommonUpdateIndicator.vue'

import {
  STUDENTHUB_LEFT_PANEL_TARGET,
  STUDENTHUB_PANEL_TAB_LABELS,
  STUDENTHUB_RIGHT_PANEL_TARGET,
  STUDENTHUB_SIDE_PANEL_KEY,
} from './studenthubSidePanel.ts'
import TicketSidebarButton from './TicketSidebarButton.vue'

import type { TicketSidebarWrapperProps } from '../../types/sidebar.ts'

const props = defineProps<TicketSidebarWrapperProps>()

// Student Hub: on the ticket screen, panels other than Ticket open on the right ("split"), or
// all of them in the sidebar column, one shown at a time ("column", see studenthubSidePanel.ts).
const sidePanel = inject(STUDENTHUB_SIDE_PANEL_KEY, null)
const isColumn = computed(() => sidePanel?.mode === 'column')

const teleportTarget = computed(() =>
  sidePanel && !isColumn.value && props.sidebar !== sidePanel.leftPanel
    ? STUDENTHUB_RIGHT_PANEL_TARGET
    : STUDENTHUB_LEFT_PANEL_TARGET,
)

const isShownInColumn = computed(() => sidePanel?.visiblePanel.value === props.sidebar)

// In the column the Ticket panel stays mounted while another one is shown, so its icon is only
// highlighted while it is the one on screen.
const isButtonSelected = computed(() => (isColumn.value ? isShownInColumn.value : props.selected))

// While the column is open its panels are named tabs (Student Hub names where they differ).
const isTab = computed(() => !!sidePanel?.tabs.value)
const tabLabel = computed(
  () => STUDENTHUB_PANEL_TAB_LABELS[props.sidebar] ?? props.sidebarPlugin.title,
)

defineEmits<{
  click: [string]
}>()
</script>

<template>
  <div>
    <!-- Like Zammad's button: the panel's name as label, the count and the update dot beside it -->
    <div v-if="isTab" class="relative">
      <button
        type="button"
        class="sh-panel-tab"
        :class="{ 'sh-panel-tab--badged': badge }"
        :aria-label="$t(tabLabel)"
        :aria-pressed="isButtonSelected"
        @click="$emit('click', sidebar)"
      >
        {{ $t(tabLabel) }}
      </button>
      <span v-if="badge" class="sh-panel-tab__badge" role="status" :aria-label="$t(badge.label)">
        {{ badge.value }}
      </span>
      <CommonUpdateIndicator
        v-if="!isButtonSelected && updateIndicator"
        class="top-0.5 ltr:right-0.5 rtl:left-0.5"
      />
    </div>
    <TicketSidebarButton
      v-else
      :key="sidebar"
      :name="sidebar"
      :label="sidebarPlugin.title"
      :icon="sidebarPlugin.icon"
      :badge="badge"
      :selected="isButtonSelected"
      :update-indicator="updateIndicator"
      @click="$emit('click', $event)"
    />
    <Teleport v-if="selected" :to="teleportTarget" defer>
      <div v-if="isColumn" v-show="isShownInColumn" class="flex min-h-0 grow flex-col">
        <slot />
      </div>
      <slot v-else />
    </Teleport>
  </div>
</template>
