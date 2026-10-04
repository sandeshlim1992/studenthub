# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub Ticket Approvals: protect the approval columns on tickets without editing
# Zammad's Ticket model.
Rails.application.config.to_prepare do
  next if Ticket < Studenthub::TicketApproval::TicketGuard

  Ticket.include(Studenthub::TicketApproval::TicketGuard)
end
