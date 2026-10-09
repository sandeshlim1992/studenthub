# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins with the request forms permission manage the forms; anyone who can raise a ticket reads
# the one that applies to them.
class Controllers::StudenthubRequestFormsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(Studenthub::RequestForms::PERMISSION)
  permit! :applicable, to: ['ticket.customer', 'ticket.agent']
end
