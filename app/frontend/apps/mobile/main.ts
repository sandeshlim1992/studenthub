// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { createApp } from 'vue'

import '#mobile/styles/main.css'

import { initializeAppName } from '#shared/composables/useAppName.ts'
import { initializeDefaultObjectAttributes } from '#shared/entities/object-attributes/composables/useObjectAttributes.ts'
import initializeGlobalComponents from '#shared/initializer/globalComponents.ts'
import initializeGlobalProperties from '#shared/initializer/globalProperties.ts'
import initializeStoreSubscriptions from '#shared/initializer/storeSubscriptions.ts'
import { setCurrentRouter } from '#shared/router/router.ts'
import { useApplicationStore } from '#shared/stores/application.ts'
import { useAuthenticationStore } from '#shared/stores/authentication.ts'
import initializeStore from '#shared/stores/index.ts'
import { useLocaleStore } from '#shared/stores/locale.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { isMobile } from '#shared/utils/browser.ts'
import { desktopAppAddress } from '#shared/utils/studenthubAppSwitch.ts'

import { setCurrentApp } from '#mobile/currentApp.ts'
import { initializeForm, initializeFormFields } from '#mobile/form/index.ts'
import { initializeGlobalComponentStyles } from '#mobile/initializer/initializeGlobalComponentStyles.ts'
import initializeGlobalDirectives from '#mobile/initializer/initializeGlobalDirectives.ts'
import { initializeMobileIcons } from '#mobile/initializer/initializeMobileIcons.ts'
import { initializeMobileVisuals } from '#mobile/initializer/mobileVisuals.ts'
import initializeRouter from '#mobile/router/index.ts'
import initializeApolloClient from '#mobile/server/apollo/index.ts'

import AppMobile from './AppMobile.vue'
import { ensureAfterAuth } from './pages/authentication/after-auth/composable/useAfterAuthPlugins.ts'

// Student Hub: opening the mobile app is choosing it, on any device, so it forgets an earlier
//   "Continue to desktop" instead of sending the person to the new UI
//   (#shared/utils/studenthubAppSwitch.ts).
window.localStorage.removeItem('forceDesktopApp')

export default async function mountApp(): Promise<void> {
  const app = createApp(AppMobile)
  initializeAppName('mobile')

  // Remember the current created app.
  setCurrentApp(app)

  initializeApolloClient(app)

  const router = initializeRouter(app)

  // Remember the initialized router.
  setCurrentRouter(router)

  initializeStore(app)
  initializeMobileIcons()
  initializeForm(app)
  initializeFormFields()
  initializeGlobalComponentStyles()
  initializeGlobalComponents(app)
  initializeGlobalProperties(app)
  initializeMobileVisuals()
  initializeStoreSubscriptions()

  initializeGlobalDirectives(app)

  const session = useSessionStore()
  const authentication = useAuthenticationStore()

  // If the session is invalid, clear the already set authentication flag from storage.
  if (!(await session.checkSession()) && authentication.authenticated) {
    authentication.authenticated = false
  }

  const application = useApplicationStore()

  const initalizeAfterSessionCheck: Array<Promise<unknown>> = [application.getConfig()]

  if (session.id) {
    authentication.authenticated = true
    initalizeAfterSessionCheck.push(session.getCurrentUser())

    // Pre-warm the default object-attribute queries in parallel with the
    // current-user and config requests, so the cache is hot by the time the
    // first form mounts and asks for them.
    initializeDefaultObjectAttributes()
  }

  await Promise.all(initalizeAfterSessionCheck)

  if (session.id) session.initialized = true

  // Student Hub: staff on a phone get the new UI (#shared/utils/studenthubAppSwitch.ts); after
  // signing in here, the router guard studenthubStaffToDesktop does the same.
  const desktopAddress = desktopAppAddress({
    path: window.location.pathname.replace(/^\/mobile/, '') || '/',
    phone: isMobile,
    staff: session.hasPermission('ticket.agent'),
  })

  if (desktopAddress) {
    window.location.replace(desktopAddress)
    return
  }

  const locale = useLocaleStore()

  if (!locale.localeData) {
    await locale.setLocale()
  }

  if (VITE_TEST_MODE) {
    await import('#shared/initializer/initializeFakeTimer.ts')
  }

  app.mount('#app')

  if (session.afterAuth) {
    await ensureAfterAuth(router, session.afterAuth)
  }
}
