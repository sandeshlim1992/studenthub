# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub Ticket Approvals, added to Zammad's classes without editing them: protect the
# approval columns on tickets, let the chosen manager and the requesting agent read a ticket
# that waits for approval, and pause its SLA meanwhile.
Rails.application.config.to_prepare do
  Ticket.include(Studenthub::TicketApproval::TicketGuard) if !(Ticket < Studenthub::TicketApproval::TicketGuard)

  {
    TicketPolicy               => Studenthub::TicketApproval::TicketAccess::Policy,
    TicketPolicy::BaseScope    => Studenthub::TicketApproval::TicketAccess::Scope,
    Escalation                 => Studenthub::TicketApproval::SlaPause::Escalation,
    Escalation::TicketBizBreak => Studenthub::TicketApproval::SlaPause::TicketBizBreak,
  }.each do |klass, extension|
    klass.prepend(extension) if klass.ancestors.exclude?(extension)
  end
end
