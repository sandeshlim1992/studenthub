<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { computed, toRef } from 'vue'

import { useSessionStore } from '#shared/stores/session.ts'
import hasPermission from '#shared/utils/hasPermission.ts'

import LayoutSidebar from '#desktop/components/layout/LayoutSidebar.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import CustomerPersonalSettingSidebar from '#desktop/pages/personal-setting/components/CustomerPersonalSettingSidebar.vue'
import PersonalSettingSidebar from '#desktop/pages/personal-setting/components/PersonalSettingSidebar.vue'

import { usePersonalSettingStore } from '../stores/personalSetting.ts'

const user = toRef(useSessionStore(), 'user')
const isCustomer = computed(
  () =>
    hasPermission('ticket.customer', user.value?.permissions?.names ?? []) &&
    !hasPermission('ticket.agent', user.value?.permissions?.names ?? []),
)

defineOptions({
  beforeRouteEnter(to) {
    usePersonalSettingStore().setPreviousPersonalSettingScreen(to.fullPath)

    return true
  },

  beforeRouteUpdate(to) {
    usePersonalSettingStore().setPreviousPersonalSettingScreen(to.fullPath)

    return true
  },
})
</script>

<template>
  <!-- CUSTOMER PERSONAL SETTING -->
  <div v-if="isCustomer" class="flex flex-col md:flex-row h-full w-full bg-[#f8fafc] overflow-hidden select-none">
    <CustomerPersonalSettingSidebar />

    <main class="flex-1 min-w-0 h-full overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">
      <RouterView #default="{ Component }">
        <KeepAlive max="1">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
    </main>
  </div>

  <!-- AGENT PERSONAL SETTING (UNTOUCHED) -->
  <div v-else class="grid h-full grid-cols-1 lg:grid-cols-[260px_1fr]">
    <LayoutSidebar
      id="personal-settings-sidebar"
      class="hidden lg:flex"
      :name="SidebarName.PersonalSetting"
      background-variant="secondary"
    >
      <PersonalSettingSidebar />
    </LayoutSidebar>

    <RouterView #default="{ Component }">
      <KeepAlive max="1">
        <component :is="Component" />
      </KeepAlive>
    </RouterView>
  </div>
</template>
