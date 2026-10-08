<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed } from 'vue'

import { useTouchDevice } from '#shared/composables/useTouchDevice.ts'

import CollapseButton from '#desktop/components/CollapseButton/CollapseButton.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'

import { useTicketSidebar } from '../composables/useTicketSidebar.ts'
import { TicketSidebarScreenType, type TicketSidebarContext } from '../types/sidebar.ts'

import StudenthubTicketSideRail from './TicketSidebar/StudenthubTicketSideRail.vue'

interface Props {
  context: TicketSidebarContext
  /** Student Hub: agents' ticket screen (queue beside the ticket): the panel icons sit at the
   * right edge of this column and every panel opens in it, one at a time. */
  studenthubPanelColumn?: boolean
}

const props = defineProps<Props>()

// Student Hub: on the ticket screen and the staff "New ticket" screen the icons and the
// panels are on the right (StudenthubTicketSideRail); this column only holds the Ticket panel,
// or, for agents on the ticket screen, every panel with the icons beside it.
const hasSideRail = computed(
  () =>
    props.context.screenType === TicketSidebarScreenType.TicketDetailView ||
    (props.context.screenType === TicketSidebarScreenType.TicketCreate &&
      props.context.view === 'agent'),
)

const { isSidebarCollapsed, toggleSidebar } = useSidebarDisplay(SidebarName.TicketContent)

const {
  activeSidebar,
  availableSidebarPlugins,
  shownSidebars,
  showSidebar,
  hideSidebar,
  switchSidebar,
} = useTicketSidebar()

const maybeToggleAndSwitchSidebar = (newSidebar: string) => {
  if (isSidebarCollapsed.value) toggleSidebar()

  switchSidebar(newSidebar)
}

const { isTouchDevice } = useTouchDevice()
</script>

<template>
  <div class="flex h-full justify-end">
    <div v-show="!isSidebarCollapsed" id="ticketSidebar" class="flex min-w-0 grow flex-col" />
    <StudenthubTicketSideRail v-if="studenthubPanelColumn" mode="column" :context="context" />
    <div
      v-if="!hasSideRail"
      class="flex flex-col items-center gap-2.5 border-neutral-100 px-2.5 py-3 transition-[border] dark:border-gray-900"
      :class="{ 'border-s': !isSidebarCollapsed }"
    >
      <component
        :is="sidebarPlugin.component"
        v-for="(sidebarPlugin, sidebar) of availableSidebarPlugins"
        v-show="shownSidebars[sidebar]"
        :key="sidebar"
        :selected="activeSidebar === sidebar"
        :sidebar="sidebar"
        :sidebar-plugin="sidebarPlugin"
        :context="context"
        @click="maybeToggleAndSwitchSidebar"
        @show="showSidebar(sidebar as string)"
        @hide="hideSidebar(sidebar as string)"
      />

      <CollapseButton
        class="mt-auto"
        :class="{ 'lg:hidden': !isTouchDevice }"
        owner-id="content-sidebar"
        visible
        no-padded
        size="large"
        variant="tertiary-gray"
        inverse
        :collapsed="isSidebarCollapsed"
        :collapse-label="$t('Collapse sidebar')"
        :expand-label="$t('Expand sidebar')"
        @toggle-collapse="toggleSidebar"
      />
    </div>
  </div>
</template>
