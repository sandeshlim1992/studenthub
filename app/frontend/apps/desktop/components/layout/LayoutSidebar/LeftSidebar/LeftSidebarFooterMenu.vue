<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
// Student Hub: no BETA UI switch, the new UI is the only one (.dev/classic-ui-removal.md).
import CollapseButton from '#desktop/components/CollapseButton/CollapseButton.vue'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'

import { SidebarName } from '../../types.ts'

const { isSidebarCollapsed, toggleSidebar } = useSidebarDisplay(SidebarName.Primary)
</script>

<template>
  <section
    class="flex items-center justify-center"
    :class="{ 'mx-auto mb-2 flex-col!': isSidebarCollapsed }"
  >
    <div class="flex w-full flex-col gap-2">
      <div class="flex gap-2" :class="{ 'mx-auto mb-0.5 flex-col!': isSidebarCollapsed }">
        <CollapseButton
          owner-id="primary-sidebar"
          no-padded
          visible
          size="large"
          variant="tertiary-gray"
          :collapsed="isSidebarCollapsed"
          :class="isSidebarCollapsed ? 'order-last' : 'order-first'"
          :collapse-label="$t('Collapse sidebar')"
          :expand-label="$t('Expand sidebar')"
          @toggle-collapse="toggleSidebar"
        />
      </div>
    </div>
  </section>
</template>
