# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Ticket access itself is checked per ticket in the controller and the services.
class Controllers::TicketApprovalsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!('ticket.agent')
  permit! %i[settings update_settings], to: 'admin.ticket_approval'
  permit! :dashboard, to: 'ticket.approver'
end
