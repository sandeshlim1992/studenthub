// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { RouteRecordRaw } from 'vue-router'

const route: RouteRecordRaw[] = [
  {
    path: '/manage',
    name: 'ManageSettings',
    component: () => import('./views/Manage.vue'),
    meta: {
      title: __('Administration'),
      icon: 'gear',
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 1,
      order: 2,
      pageKey: 'manage',
      permanentItem: true,
    },
  },
  {
    path: '/manage/users',
    name: 'ManageUsers',
    component: () => import('./views/Users.vue'),
    meta: {
      title: __('Users Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-users',
    },
  },
  {
    path: '/manage/groups',
    name: 'ManageGroups',
    component: () => import('./views/Groups.vue'),
    meta: {
      title: __('Groups Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-groups',
    },
  },
  {
    path: '/manage/organizations',
    name: 'ManageOrganizations',
    component: () => import('./views/Organizations.vue'),
    meta: {
      title: __('Organizations Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-organizations',
    },
  },
  {
    path: '/manage/overviews',
    name: 'ManageOverviews',
    component: () => import('./views/Overviews.vue'),
    meta: {
      title: __('Overviews Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-overviews',
    },
  },
  {
    path: '/manage/text_modules',
    name: 'ManageTextModules',
    component: () => import('./views/TextModules.vue'),
    meta: {
      title: __('Text Modules Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-text-modules',
    },
  },
  {
    path: '/manage/macros',
    name: 'ManageMacros',
    component: () => import('./views/Macros.vue'),
    meta: {
      title: __('Macros Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-macros',
    },
  },
  {
    path: '/manage/templates',
    name: 'ManageTemplates',
    component: () => import('./views/Templates.vue'),
    meta: {
      title: __('Templates Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-templates',
    },
  },
  {
    path: '/manage/checklists',
    name: 'ManageChecklists',
    component: () => import('./views/Checklists.vue'),
    meta: {
      title: __('Checklists Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-checklists',
    },
  },
  {
    path: '/manage/slas',
    name: 'ManageSlas',
    component: () => import('./views/Slas.vue'),
    meta: {
      title: __('SLAs Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-slas',
    },
  },
  {
    path: '/manage/triggers',
    name: 'ManageTriggers',
    component: () => import('./views/Triggers.vue'),
    meta: {
      title: __('Triggers Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-triggers',
    },
  },
  {
    path: '/manage/webhooks',
    name: 'ManageWebhooks',
    component: () => import('./views/Webhooks.vue'),
    meta: {
      title: __('Webhooks Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-webhooks',
    },
  },
  {
    path: '/manage/calendars',
    name: 'ManageCalendars',
    component: () => import('./views/Calendars.vue'),
    meta: {
      title: __('Calendars Management'),
      requiresAuth: true,
      requiredPermission: ['admin', 'admin.*'],
      level: 3,
      pageKey: 'manage-calendars',
    },
  },
]

export default route
