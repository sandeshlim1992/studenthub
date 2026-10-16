// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { useSessionStore } from '#shared/stores/session.ts'
import { isMobile } from '#shared/utils/browser.ts'

import {
  MOBILE_SLUG,
  useMobileNavigation,
} from '#desktop/composables/responsiveness/useMobileNavigation.ts'

import type { AvatarMenuPlugin } from './index.ts'

export default <AvatarMenuPlugin>{
  key: 'continue-to-mobile',
  label: __('Continue to mobile'),
  icon: 'mobile',
  link: MOBILE_SLUG,
  onClick: () => {
    const { clearForceDesktopApp, continueToMobile } = useMobileNavigation()

    clearForceDesktopApp()
    continueToMobile()
  },
  // Student Hub: back again for students on a phone and for whoever chose the desktop view in the
  // mobile app. Not for staff: the mobile app is for students and sends them back
  // (#shared/utils/studenthubAppSwitch.ts).
  show: () => {
    if (useSessionStore().hasPermission('ticket.agent')) return false

    const { forceDesktopApp } = useMobileNavigation()
    return Boolean(forceDesktopApp.value) || isMobile
  },
  order: 150,
}
