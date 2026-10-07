// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

const route: RouteRecordRaw[] = [
  {
    path: '/playground',
    name: 'Playground',
    props: true,
    component: () => import('./views/Playground.vue'),
    meta: {
      title: 'Playground',
      icon: 'logo-flat',
      requiresAuth: true,
      requiredPermission: ['admin'],
      order: 500,
    },
  },
]

// Student Hub: the dashboard (agent stats, manager dashboard, Activity Stream) is in production builds too;
// Zammad only registered it in development and test mode.
route.push({
  path: '/dashboard',
  name: 'Dashboard',
  props: true,
  component: () => import('./views/Dashboard.vue'),
  meta: {
    title: __('Dashboard'),
    requiresAuth: true,
    icon: 'speedometer2',
    requiredPermission: ['ticket.agent', 'admin'],
    order: 1,
    level: 1,
    permanentItem: true,
  },
})

export default route
