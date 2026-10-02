// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/report',
    name: 'Report',
    component: () => import('./views/Report.vue'),
    alias: ['/#report'],
    meta: {
      title: __('Reporting'),
      icon: 'speedometer2',
      requiresAuth: true,
      requiredPermission: ['report', 'admin'],
      order: 10,
      level: 1,
      permanentItem: true,
    },
  },
]

export default routes
