<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue'

import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'

import { useTicketSidebar } from '../../composables/useTicketSidebar.ts'

import { STUDENTHUB_SIDE_PANEL_KEY, type StudenthubSidePanelMode } from './studenthubSidePanel.ts'

import type { TicketSidebarContext } from '../../types/sidebar.ts'

// Student Hub: the ticket sidebar's icons on the right edge of the ticket screen.
// - "split" (students, New ticket): the Ticket panel (Details, SLA…) always stays in the sidebar
//   column on the left; every other panel (Customer, Checklist, Approval…) opens here on the right.
// - "column" (agents, with the queue beside the ticket; the rail sits in the sidebar column on the
//   right): every panel opens in that column, one at a time, and the Ticket panel has an icon too.
// Zammad's "active sidebar" decides which one: back on "information" means the Ticket panel.
// Customers and managers without another staff role get no icons at all (managers decide under
// the messages instead).
interface Props {
  context: TicketSidebarContext
  mode?: StudenthubSidePanelMode
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'split',
})

const INFORMATION = 'information'

const isColumn = computed(() => props.mode === 'column')

const {
  activeSidebar,
  availableSidebarPlugins,
  shownSidebars,
  showSidebar,
  hideSidebar,
  switchSidebar,
} = useTicketSidebar()

const { isSidebarCollapsed } = useSidebarDisplay(SidebarName.TicketContent)

const { isLoaded: isViewerLoaded, isManagerOnly } = useStudenthubApprovalViewer()

// Hidden until we know, so managers don't see the icons flash up.
const isRailHidden = computed(
  () => props.context.view === 'customer' || !isViewerLoaded.value || isManagerOnly.value,
)

// Without the rail only the Ticket panel is mounted: it shows itself in the left column.
const railPlugins = computed(() =>
  isRailHidden.value
    ? Object.fromEntries(
        Object.entries(availableSidebarPlugins.value).filter(
          ([sidebar]) => sidebar === INFORMATION,
        ),
      )
    : availableSidebarPlugins.value,
)

// Closed with × or its icon. Needed on "New ticket", which has no Ticket panel to go back to:
// there Zammad keeps the first panel (e.g. Customer) active. Zammad opening a panel itself
// (e.g. Checklist when closing a ticket with open items) shows it again.
const isDismissed = ref(false)
watch(activeSidebar, () => {
  isDismissed.value = false
})

const openPanel = computed(() => {
  if (isRailHidden.value || isDismissed.value) return null
  const sidebar = activeSidebar.value
  if (!sidebar || sidebar === INFORMATION || !availableSidebarPlugins.value[sidebar]) return null
  return sidebar
})

const openPanelTitle = computed(() =>
  openPanel.value ? availableSidebarPlugins.value[openPanel.value].title : '',
)

const hasIcons = computed(() =>
  Object.keys(railPlugins.value).some(
    (sidebar) => sidebar !== INFORMATION && shownSidebars.value[sidebar],
  ),
)

provide(STUDENTHUB_SIDE_PANEL_KEY, {
  leftPanel: INFORMATION,
  mode: props.mode,
  visiblePanel: computed(() => openPanel.value ?? INFORMATION),
})

const close = () => {
  isDismissed.value = true
  if (availableSidebarPlugins.value[INFORMATION]) switchSidebar(INFORMATION)
}

const toggle = (sidebar: string) => {
  // A collapsed column opens on the panel that was clicked (switchSidebar expands it).
  if (openPanel.value === sidebar && !(isColumn.value && isSidebarCollapsed.value)) {
    close()
    return
  }
  switchSidebar(sidebar)
  isDismissed.value = false
}
</script>

<template>
  <div
    class="sh-side-rail-wrap print:hidden"
    :class="{ 'sh-side-rail-wrap--hidden': isRailHidden || !hasIcons }"
  >
    <section
      v-if="!isColumn"
      v-show="openPanel"
      class="sh-side-panel"
      :aria-label="$t(openPanelTitle)"
      data-test-id="studenthub-side-panel"
    >
      <button
        type="button"
        class="sh-side-panel__close"
        :aria-label="$t('Close panel')"
        @click="close"
      >
        <CommonIcon name="x-lg" size="xs" decorative />
      </button>
      <div id="studenthubSidePanel" class="sh-side-panel__body flex h-full min-h-0 flex-col" />
    </section>

    <nav v-show="!isRailHidden && hasIcons" class="sh-side-rail" :aria-label="$t('Ticket panels')">
      <!-- The Ticket panel needs its plugin mounted (it moves itself to the sidebar column), but
           in "split" not its button: it is always open there. -->
      <component
        :is="sidebarPlugin.component"
        v-for="(sidebarPlugin, sidebar) of railPlugins"
        v-show="shownSidebars[sidebar] && (isColumn || sidebar !== INFORMATION)"
        :key="sidebar"
        :selected="sidebar === INFORMATION || openPanel === sidebar"
        :sidebar="sidebar"
        :sidebar-plugin="sidebarPlugin"
        :context="context"
        @click="toggle"
        @show="showSidebar(sidebar as string)"
        @hide="hideSidebar(sidebar as string)"
      />
    </nav>
  </div>
</template>
