// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { computed } from 'vue'
import { type RouteLocationNormalizedLoaded, useRoute } from 'vue-router'

import { useSessionStore } from '#shared/stores/session.ts'

import { sortedFirstLevelRoutes } from '#desktop/components/PageNavigation/firstLevelRoutes.ts'
import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'

// Student Hub: navigation design C (rail + panel). The rail lists the pages of the navigation with a
// short label (the full name is the tooltip); the panel beside it belongs to the rail item that is
// open: the ticket views and Recent on Tickets and the ticket screens, the dashboards and who is
// online on the Dashboard, the filters of the Members page there, Recent elsewhere. Where the panel
// has no Recent, the rail offers it.

export type StudenthubRailRoute = (typeof sortedFirstLevelRoutes)[number]

const SHORT_TITLES: Record<string, string> = {
  StudenthubKnowledgeBase: __('KB'),
  Report: __('Reports'),
  ManageSettings: __('Admin'),
}

export const railTitle = (route: StudenthubRailRoute) =>
  SHORT_TITLES[route.name] ?? route.meta.title

// '/tickets/view/:overviewLink?' → '/tickets/view'
export const railLink = (route: StudenthubRailRoute) => route.path.replace(/\/:.*$/, '') || '/'

const TICKET_ROUTE_NAMES = new Set(['TicketOverview', 'TicketDetailView', 'TicketCreate'])

export const isTicketSectionRoute = (route: RouteLocationNormalizedLoaded) =>
  TICKET_ROUTE_NAMES.has(String(route.name)) || /^\/tickets?\//.test(route.path)

export const useStudenthubNav = () => {
  const route = useRoute()
  const { hasPermission } = useSessionStore()

  // Members isn't for managers without another staff role, whose Managers role carries ticket.agent.
  const { isManagerOnly } = useStudenthubApprovalViewer()

  const railRoutes = computed(() =>
    sortedFirstLevelRoutes.filter(
      (railRoute) =>
        hasPermission(railRoute.meta.requiredPermission) &&
        !(railRoute.meta.studenthubHideFromManagersOnly && isManagerOnly.value),
    ),
  )

  const isRailRouteActive = (railRoute: StudenthubRailRoute) => {
    if (route.name === railRoute.name) return true
    if (railRoute.name === 'TicketOverview') return isTicketSectionRoute(route)

    const link = railLink(railRoute)
    return link !== '/' && (route.path === link || route.path.startsWith(`${link}/`))
  }

  const isTicketSection = computed(() => isTicketSectionRoute(route))
  const isDashboardSection = computed(() => route.name === 'Dashboard')
  const isMembersSection = computed(() => route.name === 'StudenthubMembers')
  const hasPanelRecent = computed(() => !isDashboardSection.value && !isMembersSection.value)

  const sectionTitle = computed(
    () =>
      railRoutes.value.find(isRailRouteActive)?.meta.title ??
      (route.meta.title as string | undefined) ??
      '',
  )

  return {
    railRoutes,
    isRailRouteActive,
    isTicketSection,
    isDashboardSection,
    isMembersSection,
    hasPanelRecent,
    sectionTitle,
  }
}
