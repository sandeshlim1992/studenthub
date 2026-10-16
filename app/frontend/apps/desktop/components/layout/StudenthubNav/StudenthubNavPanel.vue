<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { storeToRefs } from 'pinia'

import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import UserTaskbarTabs from '#desktop/components/UserTaskbarTabs/UserTaskbarTabs.vue'
import { useStudenthubMembersAccess } from '#desktop/composables/useStudenthubMembers.ts'
import { useStudenthubRoleLabel } from '#desktop/composables/useStudenthubRoleLabel.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'

import { useStudenthubNav } from './studenthubNav.ts'
import StudenthubNavDashboard from './StudenthubNavDashboard.vue'
import StudenthubNavKnowledgeBase from './StudenthubNavKnowledgeBase.vue'
import StudenthubNavMembers from './StudenthubNavMembers.vue'
import StudenthubNavOnlineMembers from './StudenthubNavOnlineMembers.vue'
import StudenthubNavTicketViews from './StudenthubNavTicketViews.vue'

// Student Hub: the panel of navigation design C, beside the rail: the user's role, the title of the
// open rail item, then on Tickets and the ticket screens the ticket views and Recent (Zammad's
// tabs), on the Dashboard the dashboards, "Needs attention" and who is online, on the Members page
// its filters, on the Knowledge Base its categories, elsewhere Recent.
// Hiding it is remembered like Zammad's collapsed sidebar (SidebarName.Primary).

const {
  isTicketSection,
  isDashboardSection,
  isMembersSection,
  isKnowledgeBaseSection,
  hasPanelRecent,
  sectionTitle,
} = useStudenthubNav()
const canSeeMembers = useStudenthubMembersAccess()
const { toggleSidebar } = useSidebarDisplay(SidebarName.Primary)
const roleLabel = useStudenthubRoleLabel()

const { hasTaskbarTabs, loading: isTaskbarLoading } = storeToRefs(useUserCurrentTaskbarTabsStore())
</script>

<template>
  <aside
    id="studenthub-nav-panel"
    class="sh-nav-panel print:hidden"
    aria-labelledby="studenthub-nav-panel-title"
  >
    <header class="sh-nav-panel__head">
      <div class="min-w-0">
        <p v-if="roleLabel" class="sh-nav-panel__role" data-test-id="studenthub-role">
          {{ $t(roleLabel) }}
        </p>
        <h2 id="studenthub-nav-panel-title" class="sh-nav-panel__title">
          {{ $t(sectionTitle) }}
        </h2>
      </div>
      <CommonButton
        v-tooltip="$t('Hide panel')"
        class="sh-nav-panel__hide"
        icon="arrow-bar-left"
        size="medium"
        variant="neutral"
        aria-expanded="true"
        @click="toggleSidebar(true)"
      />
    </header>

    <StudenthubNavTicketViews v-if="isTicketSection" class="sh-nav-panel__views" />
    <StudenthubNavDashboard v-else-if="isDashboardSection" class="sh-nav-panel__views" />
    <StudenthubNavMembers v-else-if="isMembersSection" class="sh-nav-panel__views" />
    <StudenthubNavKnowledgeBase v-else-if="isKnowledgeBaseSection" class="sh-nav-panel__views" />

    <div v-if="isDashboardSection" class="sh-nav-panel__foot">
      <StudenthubNavOnlineMembers v-if="canSeeMembers" />
    </div>
    <div
      v-else-if="hasPanelRecent"
      class="sh-nav-panel__recent"
      :class="{ 'sh-nav-panel__recent--end': isTicketSection }"
    >
      <UserTaskbarTabs />
      <template v-if="!isTaskbarLoading && !hasTaskbarTabs">
        <p class="sh-nav-panel__label">{{ $t('Recent') }}</p>
        <p class="sh-nav-panel__empty">{{ $t('Tickets you open are listed here.') }}</p>
      </template>
    </div>
  </aside>
</template>
