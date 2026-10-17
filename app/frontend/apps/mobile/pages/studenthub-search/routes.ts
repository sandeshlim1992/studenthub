// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

// Student Hub: the students' search from Home (help articles, request types, their tickets);
// staff keep Zammad's search (/search).

const routes: RouteRecordRaw[] = [
  {
    path: '/find',
    name: 'StudenthubSearch',
    component: () => import('./views/StudenthubSearch.vue'),
    meta: {
      title: __('Search'),
      requiresAuth: true,
      requiredPermission: ['ticket.customer'],
      hasBottomNavigation: true,
      level: 2,
    },
  },
]

export default routes
