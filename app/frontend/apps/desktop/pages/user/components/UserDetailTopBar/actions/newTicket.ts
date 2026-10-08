// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

import type { User } from '#shared/graphql/types.ts'

import { useStudenthubApprovalViewer } from '#desktop/composables/useStudenthubApprovalViewer.ts'
import type { DetailViewActionPlugin } from '#desktop/types/actions.ts'

import type { Router } from 'vue-router'

export default <DetailViewActionPlugin>{
  key: 'new-ticket',
  label: __('New ticket'),
  icon: 'plus-square-fill',
  variant: 'secondary',
  showLabel: true,
  permission: 'ticket.agent',
  order: 200,
  topLevel: true,
  // Student Hub: managers without another staff role can't raise tickets for someone else.
  show: () => !useStudenthubApprovalViewer().isManagerOnly.value,
  onClick: (user?: User, router?: Router) => {
    if (!user) return

    router?.push({
      name: 'TicketCreate',
      query: { customer_id: user.internalId },
    })
  },
}
