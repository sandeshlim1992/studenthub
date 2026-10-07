# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins of Ticket Approvals assign the sites; managers see the numbers of their own sites.
class Controllers::StudenthubManagerSitesControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! %i[index update], to: 'admin.ticket_approval'
  permit! :stats, to: 'ticket.approver'
end
