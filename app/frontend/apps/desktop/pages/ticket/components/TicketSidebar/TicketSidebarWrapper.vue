<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, inject } from 'vue'

import {
  STUDENTHUB_LEFT_PANEL_TARGET,
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

defineEmits<{
  click: [string]
}>()
</script>

<template>
  <div>
    <TicketSidebarButton
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
