// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import { ErrorRouteType, redirectErrorRoute } from '#shared/router/error.ts'
import { useSessionStore } from '#shared/stores/session.ts'
import { ErrorStatusCodes } from '#shared/types/error.ts'

import type { RouteLocation, RouteRecordRaw } from 'vue-router'

// Student Hub: the Knowledge Base for staff (read, write and edit answers and categories), moved
// from the classic UI. One page; the path says what it shows:
//   /knowledge-base                      start page
//   /knowledge-base/category/5           a category
//   /knowledge-base/category/5/new       a new answer in that category
//   /knowledge-base/answer/7             an answer
//   /knowledge-base/answer/7/edit        editing it
// The classic UI's addresses (#knowledge_base/1/locale/en-us/answer/7/edit and the like, in the help
// center's edit links and the activity stream) lead to the same page.
const classicPath = (to: RouteLocation) => {
  const { kind, id, mode } = to.params
  if (!kind || !id) return '/knowledge-base'

  return kind === 'answer' && mode
    ? `/knowledge-base/answer/${id}/edit`
    : `/knowledge-base/${kind}/${id}`
}

const routes: RouteRecordRaw[] = [
  {
    path: '/knowledge_base/:knowledgeBaseId(\\d+)/locale/:locale/:kind(category|answer)?/:id(\\d+)?/:mode(edit)?',
    redirect: classicPath,
  },
  {
    path: '/knowledge-base/:kind(category|answer)?/:id(\\d+)?/:mode(edit|new)?',
    name: 'StudenthubKnowledgeBase',
    component: () => import('./views/StudenthubKnowledgeBase.vue'),
    meta: {
      title: __('Knowledge Base'),
      icon: 'book',
      requiresAuth: true,
      requiredPermission: ['knowledge_base.reader', 'knowledge_base.editor'],
      order: 1.4,
      level: 1,
      permanentItem: true,
      pageKey: 'studenthub-knowledge-base',
    },
    // Students have Knowledge Base read access too; they use the public help center.
    beforeEnter: () => {
      if (useSessionStore().hasPermission(['ticket.agent', 'admin'])) return true

      return redirectErrorRoute({
        type: ErrorRouteType.AuthenticatedError,
        title: __('Forbidden'),
        message: __('The Knowledge Base here is for staff.'),
        statusCode: ErrorStatusCodes.Forbidden,
      })
    },
  },
]

export default routes
