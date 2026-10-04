// Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

// Student Hub Ticket Approvals: "Approval" tab in the ticket sidebar.

import { useApplicationStore } from '#shared/stores/application.ts'

import { TicketSidebarScreenType } from '../../../types/sidebar.ts'
import TicketSidebarStudenthubApproval from '../TicketSidebarStudenthubApproval/TicketSidebarStudenthubApproval.vue'

import type { TicketSidebarPlugin } from './types.ts'

export default <TicketSidebarPlugin>{
  title: __('Approval'),
  component: TicketSidebarStudenthubApproval,
  permissions: ['ticket.agent'],
  screens: [TicketSidebarScreenType.TicketDetailView],
  views: ['agent'],
  icon: 'check2-circle',
  order: 8500,
  available: () => {
    const { config } = useApplicationStore()

    return Boolean(config.ticket_approval)
  },
}
