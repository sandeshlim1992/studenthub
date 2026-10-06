# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Overview visibility itself is checked by Ticket::Overviews.all for the current user.
class Controllers::StudenthubTicketViewsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!('ticket.agent')
end
