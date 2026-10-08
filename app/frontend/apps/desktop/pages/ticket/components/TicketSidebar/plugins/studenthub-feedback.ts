// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub Feedback Collection: "Customer feedback" in the ticket sidebar of closed tickets: the
// rating (and comment) the customer gave after the ticket was closed. Admins only.

import { TicketSidebarScreenType } from '../../../types/sidebar.ts'
import TicketSidebarStudenthubFeedback from '../TicketSidebarStudenthubFeedback/TicketSidebarStudenthubFeedback.vue'

import type { TicketSidebarPlugin } from './types.ts'

export default <TicketSidebarPlugin>{
  title: __('Customer feedback'),
  component: TicketSidebarStudenthubFeedback,
  permissions: ['admin.feedback_collection'],
  screens: [TicketSidebarScreenType.TicketDetailView],
  views: ['agent'],
  icon: 'star',
  order: 8600,
  available: (context) => context.ticket?.value?.state?.stateType?.name === 'closed',
}
