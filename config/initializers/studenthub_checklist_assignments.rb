# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: tickets get the checklist chosen for their Category › Sub-category
# (Studenthub::ChecklistAssignments), added to Zammad's Ticket without editing it.
Rails.application.config.to_prepare do
  Ticket.include(Studenthub::ChecklistAssignments::TicketHook) if Ticket.ancestors.exclude?(Studenthub::ChecklistAssignments::TicketHook)
end
