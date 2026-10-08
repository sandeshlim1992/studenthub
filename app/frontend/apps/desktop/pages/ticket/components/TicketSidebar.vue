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
  /** Student Hub: agents' ticket screen (queue beside the ticket): every panel opens in this
   * column, one at a time, chosen with tabs above it (icons beside it while collapsed); the
   * `studenthubFooter` slot (Update…) sits at its foot while it is open. */
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
  <!-- Student Hub: in the agents' panel column the tabs sit above the panel (icons beside it
       while the column is collapsed). -->
  <div
    class="flex h-full"
    :class="studenthubPanelColumn && !isSidebarCollapsed ? 'flex-col' : 'justify-end'"
  >
    <StudenthubTicketSideRail v-if="studenthubPanelColumn" mode="column" :context="context" />
    <div
      v-show="!isSidebarCollapsed"
      id="ticketSidebar"
      class="flex min-h-0 min-w-0 grow flex-col"
    />
    <!-- Student Hub: the agents' save area (Update…) at the foot of the open column -->
    <slot v-if="studenthubPanelColumn && !isSidebarCollapsed" name="studenthubFooter" />
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
