<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { useRouter } from 'vue-router'

import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import UserTaskbarTabs from '#desktop/components/UserTaskbarTabs/UserTaskbarTabs.vue'

import { railLink, railTitle, useStudenthubNav } from './studenthubNav.ts'

// Student Hub: the rail of navigation design C, always shown, in the application colour. While the
// panel is hidden, on pages whose panel has no Recent (Dashboard, Members, Knowledge Base) and on
// pages without a panel (Administration, Reporting), Recent is Zammad's list of tabs behind a
// button (UserTaskbarTabs, collapsed). Show panel is only offered where there is one.

const router = useRouter()

const { railRoutes, isRailRouteActive, hasPanel, hasPanelRecent } = useStudenthubNav()

const { isSidebarCollapsed: isPanelHidden, toggleSidebar } = useSidebarDisplay(SidebarName.Primary)
</script>

<template>
  <aside
    id="primary-sidebar"
    class="sh-nav-rail print:hidden"
    :aria-label="$t('Main sidebar')"
    data-theme="dark"
  >
    <button
      v-tooltip="$t('Go to start page')"
      type="button"
      class="sh-nav-rail__logo"
      @click="router.push('/')"
    >
      <img :src="studentHubLogo" alt="" />
    </button>

    <nav :aria-label="$t('Navigation')">
      <ul class="sh-nav-rail__list">
        <li v-for="railRoute in railRoutes" :key="railRoute.path">
          <CommonLink
            v-tooltip.supportive="$t(railRoute.meta.title)"
            class="sh-nav-rail__item"
            :class="{ 'sh-nav-rail__item--active': isRailRouteActive(railRoute) }"
            :aria-current="isRailRouteActive(railRoute) ? 'page' : undefined"
            :link="railLink(railRoute)"
            internal
          >
            <CommonIcon :name="railRoute.meta.icon" size="small" decorative />
            <span class="sh-nav-rail__label">{{ $t(railTitle(railRoute)) }}</span>
          </CommonLink>
        </li>
      </ul>
    </nav>

    <div class="sh-nav-rail__foot">
      <UserTaskbarTabs v-if="isPanelHidden || !hasPanelRecent" collapsed />
      <CommonButton
        v-if="isPanelHidden && hasPanel"
        v-tooltip="$t('Show panel')"
        class="sh-nav-rail__toggle"
        icon="arrow-bar-right"
        size="large"
        variant="neutral"
        aria-expanded="false"
        @click="toggleSidebar(false)"
      />
    </div>
  </aside>
</template>
