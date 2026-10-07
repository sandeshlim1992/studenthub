// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ErrorRouteType, redirectErrorRoute } from '#shared/router/error.ts'
import { ErrorStatusCodes } from '#shared/types/error.ts'

import { waitForStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'

import type { RouteRecordRaw } from 'vue-router'

// Student Hub: the Members page (agents and admins online, last login).
const routes: RouteRecordRaw[] = [
  {
    path: '/members',
    name: 'StudenthubMembers',
    component: () => import('./views/StudenthubMembers.vue'),
    meta: {
      title: __('Members'),
      icon: 'people-fill',
      requiresAuth: true,
      requiredPermission: ['ticket.agent', 'admin'],
      order: 1.5,
      level: 1,
      permanentItem: true,
      // Managers without another staff role carry ticket.agent too, but aren't members.
      studenthubHideFromManagersOnly: true,
    },
    beforeEnter: async () => {
      const { isManagerOnly } = await waitForStudenthubApprovalViewer()
      if (!isManagerOnly.value) return true

      return redirectErrorRoute({
        type: ErrorRouteType.AuthenticatedError,
        title: __('Forbidden'),
        message: __('Only agents and admins can see the members.'),
        statusCode: ErrorStatusCodes.Forbidden,
      })
    },
  },
]

export default routes
