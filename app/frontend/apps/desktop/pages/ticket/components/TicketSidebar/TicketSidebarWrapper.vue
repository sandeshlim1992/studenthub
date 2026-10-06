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

// Student Hub: on the ticket screen, panels other than Ticket open on the right.
const sidePanel = inject(STUDENTHUB_SIDE_PANEL_KEY, null)
const teleportTarget = computed(() =>
  sidePanel && props.sidebar !== sidePanel.leftPanel
    ? STUDENTHUB_RIGHT_PANEL_TARGET
    : STUDENTHUB_LEFT_PANEL_TARGET,
)

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
      :selected="selected"
      :update-indicator="updateIndicator"
      @click="$emit('click', $event)"
    />
    <Teleport v-if="selected" :to="teleportTarget" defer>
      <slot />
    </Teleport>
  </div>
</template>
