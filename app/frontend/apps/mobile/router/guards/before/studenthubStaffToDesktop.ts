// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { useSessionStore } from '#shared/stores/session.ts'
import { isMobile } from '#shared/utils/browser.ts'
import { desktopAppAddress } from '#shared/utils/studenthubAppSwitch.ts'

import type { NavigationGuard } from 'vue-router'

// Student Hub: the mobile app is for students, so staff on a phone get the new UI, also right after
// signing in here (#shared/utils/studenthubAppSwitch.ts). At startup, before the signed-in person
// is known, main.ts does the same check.
const studenthubStaffToDesktop: NavigationGuard = (to) => {
  const session = useSessionStore()
  if (!session.user) return true

  const address = desktopAppAddress({
    path: to.path,
    phone: isMobile,
    staff: session.hasPermission('ticket.agent'),
  })
  if (!address) return true

  window.location.replace(address)
  return false
}

export default studenthubStaffToDesktop
