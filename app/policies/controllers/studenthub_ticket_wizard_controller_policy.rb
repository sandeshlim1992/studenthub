# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Anyone who can raise a ticket.
class Controllers::StudenthubTicketWizardControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(['ticket.customer', 'ticket.agent'])
end
