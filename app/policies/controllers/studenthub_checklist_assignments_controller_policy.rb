# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins who manage checklist templates choose which sub-categories get them automatically.
# Agents see which checklist a ticket's sub-category gets (the controller checks the ticket).
class Controllers::StudenthubChecklistAssignmentsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(Studenthub::ChecklistAssignments::PERMISSION)
  permit! :for_ticket, to: 'ticket.agent'
end
