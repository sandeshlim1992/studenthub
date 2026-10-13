# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Full admins assign the sites: a site gives its managers read access to all of that organisation's
# tickets, more than switching Ticket Approvals on or off (admin.ticket_approval) should hand out.
# Managers see the numbers of their own sites.
class Controllers::StudenthubManagerSitesControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! %i[index update], to: 'admin'
  permit! :stats, to: 'ticket.approver'
end
