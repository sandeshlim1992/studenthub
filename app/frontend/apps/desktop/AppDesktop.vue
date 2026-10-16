<!-- Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/ -->

<script setup lang="ts">
import { onBeforeMount, watch } from 'vue'
import { useRouter } from 'vue-router'
import Button from './components/ui/button/Button.vue'

import CommonImageViewer from '#shared/components/CommonImageViewer/CommonImageViewer.vue'
import CommonNotifications from '#shared/components/CommonNotifications/CommonNotifications.vue'
import DynamicInitializer from '#shared/components/DynamicInitializer/DynamicInitializer.vue'
import useAuthenticationChanges from '#shared/composables/authentication/useAuthenticationUpdates.ts'
import useFormKitConfig from '#shared/composables/form/useFormKitConfig.ts'
import useAppMaintenanceCheck from '#shared/composables/useAppMaintenanceCheck.ts'
import useMetaTitle from '#shared/composables/useMetaTitle.ts'
import { useOnEmitter } from '#shared/composables/useOnEmitter.ts'
import usePushMessages from '#shared/composables/usePushMessages.ts'
import { useStudenthubAppColor } from '#shared/composables/useStudenthubAppColor.ts'
import { initializeDefaultObjectAttributes } from '#shared/entities/object-attributes/composables/useObjectAttributes.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useAuthenticationStore } from '#shared/stores/authentication.ts'
import { useLocaleStore } from '#shared/stores/locale.ts'
import { useSessionStore } from '#shared/stores/session.ts'

import { initializeConfirmationDialog } from '#desktop/components/CommonConfirmationDialog/initializeConfirmationDialog.ts'
import { useConnection } from '#desktop/composables/useConnection.ts'
import { useTicketOverviewsStore } from '#desktop/entities/ticket/stores/ticketOverviews.ts'
import { useUserCurrentTaskbarTabsStore } from '#desktop/entities/user/current/stores/taskbarTabs.ts'
import { useTicketBulkUpdateStore } from '#desktop/entities/user/current/stores/ticketBulkUpdate.ts'

import { useMobileDetection } from './composables/responsiveness/useMobileDetection.ts'

import studentHubLogo from '#desktop/assets/images/student_hub_logo.png'

const router = useRouter()

const authentication = useAuthenticationStore()
const session = useSessionStore()

useMetaTitle().initializeMetaTitle()

const application = useApplicationStore()
onBeforeMount(() => {
  application.setLoaded()
})
useAppMaintenanceCheck()

// Student Hub: application colour chosen by admins under Branding.
useStudenthubAppColor()
usePushMessages()

// Add a check for authenticated changes (e.g. login/logout in a other
// browser tab or maintenance mode switch).
useAuthenticationChanges()

// Student Hub: no BETA switch, feedback program or "New desktop BETA UI … not ready for production use"
// warning: the new UI is the only one (the classic UI is switched off, .dev/classic-ui-removal.md).

// We need to trigger a manual translation update for the form related strings.
const formConfig = useFormKitConfig()
useLocaleStore().$subscribe(() => {
  formConfig.locale = 'staticLocale'
})

// The handling for invalid sessions. The event will be emitted, when from the server a "NotAuthorized"
// response is received.
useOnEmitter('session-invalid', async () => {
  if (authentication.authenticated) {
    await authentication.clearAuthentication()

    router.replace({
      name: 'Login',
      query: {
        invalidatedSession: '1',
      },
    })
  }
})

initializeConfirmationDialog()

// Initialize the user taskbar tabs store after a valid session is present on
// the app level, so that the query keeps alive.
watch(
  () => session.initialized,
  (newValue, oldValue) => {
    if (!newValue || oldValue) return

    useUserCurrentTaskbarTabsStore()
    useTicketOverviewsStore()
    initializeDefaultObjectAttributes()
    useTicketBulkUpdateStore()
    useMobileDetection()
  },
  { immediate: true },
)

useConnection()
</script>

<template>
  <template v-if="application.loaded">
    <CommonNotifications />
    <Teleport to="body">
      <CommonImageViewer />
    </Teleport>
    <RouterView />

    <DynamicInitializer name="dialog" />
    <DynamicInitializer name="flyout" />
  </template>
</template>

