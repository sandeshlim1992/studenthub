<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import AddMenu from '#desktop/components/layout/LayoutSidebar/LeftSidebar/MenuContainer/AddMenu/AddMenu.vue'
import AdminMenu from '#desktop/components/layout/LayoutSidebar/LeftSidebar/MenuContainer/AdminMenu/AdminMenu.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'

const { isSidebarCollapsed } = useSidebarDisplay(SidebarName.Primary)
</script>

<template>
  <div
    role="list"
    class="flex items-center gap-1.5 rounded-xl bg-slate-900/60 p-1.5 border border-white/10 shadow-2xs empty:hidden"
    :class="{ 'flex-col bg-transparent border-none': isSidebarCollapsed }"
  >
    <AdminMenu role="listitem" />
    <AddMenu role="listitem" />
  </div>
</template>
