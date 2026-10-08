// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { useSessionStore } from '#shared/stores/session.ts'
import log from '#shared/utils/log.ts'

import type { NavigationGuard, RouteLocationNormalized } from 'vue-router'

// Student Hub: the home page of staff is the Dashboard. "/" is an alias of the Tickets page, and
// Zammad sends everyone there after signing in (password and Microsoft 365), so staff are sent on to
// the Dashboard; students keep their ticket list. Links to other pages are left alone.
const studenthubHome: NavigationGuard = (to: RouteLocationNormalized) => {
  if (to.path !== '/') return true

  const session = useSessionStore()
  if (!session.user || !session.hasPermission(['ticket.agent', 'admin'])) return true

  log.debug(`Route guard for '${to.path}': Student Hub home - dashboard.`)

  return { path: '/dashboard', replace: true }
}

export default studenthubHome
