<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { FormKit } from '@formkit/vue'
import { storeToRefs } from 'pinia'

import { useBetaUi } from '#desktop/components/BetaUi/composables/useBetaUi.ts'
import { showFeedbackConsent } from '#desktop/components/BetaUi/composables/useBetaUiFeedbackConsent.ts'
import { useFeedbackDialog } from '#desktop/components/BetaUi/FeedbackDialog/useFeedbackDialog.ts'
import CommonButton from '#desktop/components/CommonButton/CommonButton.vue'
import { SidebarName } from '#desktop/components/layout/types.ts'
import { useSidebarDisplay } from '#desktop/components/layout/useSidebarDisplay.ts'
import UserTaskbarTabs from '#desktop/components/UserTaskbarTabs/UserTaskbarTabs.vue'
import { useStudenthubRoleLabel } from '#desktop/composables/useStudenthubRoleLabel.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'

import { useStudenthubNav } from './studenthubNav.ts'
import StudenthubNavTicketViews from './StudenthubNavTicketViews.vue'

// Student Hub: the panel of navigation design C, beside the rail: the user's role, the title of the
// open rail item, the ticket views on Tickets and the ticket screens, then Recent (Zammad's tabs).
// Hiding it is remembered like Zammad's collapsed sidebar (SidebarName.Primary). The BETA UI switch
// moved here from Zammad's sidebar footer.

const { isTicketSection, sectionTitle } = useStudenthubNav()
const { toggleSidebar } = useSidebarDisplay(SidebarName.Primary)
const roleLabel = useStudenthubRoleLabel()

const { hasTaskbarTabs, loading: isTaskbarLoading } = storeToRefs(useUserCurrentTaskbarTabsStore())

const {
  switchValue,
  toggleBetaUiSwitch,
  betaUiSwitchEnabled,
  dismissBetaUiSwitch,
  hasFeedbackConsent,
} = useBetaUi()

const { openFeedbackDialog } = useFeedbackDialog()
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

    <div class="sh-nav-panel__recent" :class="{ 'sh-nav-panel__recent--end': isTicketSection }">
      <UserTaskbarTabs />
      <template v-if="!isTaskbarLoading && !hasTaskbarTabs">
        <p class="sh-nav-panel__label">{{ $t('Recent') }}</p>
        <p class="sh-nav-panel__empty">{{ $t('Tickets you open are listed here.') }}</p>
      </template>
    </div>

    <div v-if="betaUiSwitchEnabled" class="sh-nav-panel__beta">
      <FormKit
        type="toggle"
        :label="__('BETA UI')"
        :value="true"
        :variants="{ true: 'True', false: 'False' }"
        wrapper-class="!flex-row"
        label-class="truncate"
        @input-raw="toggleBetaUiSwitch()"
      />
      <CommonLink
        v-if="switchValue"
        class="truncate"
        link="#"
        size="small"
        @click="
          () => (hasFeedbackConsent === 'true' ? openFeedbackDialog() : showFeedbackConsent())
        "
      >
        {{ $t('Feedback') }}
      </CommonLink>
      <CommonButton
        v-tooltip="$t('Hide BETA UI switch')"
        class="ms-auto shrink-0"
        icon="x"
        size="small"
        variant="neutral"
        @click="dismissBetaUiSwitch"
      />
    </div>
  </aside>
</template>
