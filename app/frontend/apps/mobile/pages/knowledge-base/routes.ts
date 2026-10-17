// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

// Student Hub: the Knowledge Base in the mobile app (design 1 "Topics"), what the help center
// publishes. The top topics and each topic share a page.

const routes: RouteRecordRaw[] = [
  {
    path: '/knowledge-base/:categoryId(\\d+)?',
    name: 'StudenthubKnowledgeBase',
    props: true,
    component: () => import('./views/StudenthubKnowledgeBase.vue'),
    meta: {
      title: __('Help articles'),
      requiresAuth: true,
      requiredPermission: ['ticket.customer', 'ticket.agent'],
      hasBottomNavigation: true,
      level: 2,
    },
  },
  {
    path: '/knowledge-base/answers/:answerId(\\d+)',
    name: 'StudenthubKnowledgeBaseAnswer',
    props: true,
    component: () => import('./views/StudenthubKnowledgeBaseAnswer.vue'),
    meta: {
      title: __('Help articles'),
      requiresAuth: true,
      requiredPermission: ['ticket.customer', 'ticket.agent'],
      hasBottomNavigation: true,
      level: 3,
    },
  },
]

export default routes
