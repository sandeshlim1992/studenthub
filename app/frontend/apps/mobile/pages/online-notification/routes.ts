// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/notifications',
    name: 'NotificationsList',
    // Student Hub: the students' notifications, with the app's own header (design C1).
    component: () => import('./views/StudenthubNotifications.vue'),
    meta: {
      title: __('Notifications'),
      requiresAuth: true,
      requiredPermission: null,
      hasBottomNavigation: true,
      level: 1,
    },
  },
]

export default routes
