# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub Ticket Approvals, added to Zammad's classes without editing them: protect the
# approval columns on tickets, let the chosen manager and the requesting agent read a ticket
# that waits for approval, pause its SLA meanwhile, put the approval overviews back when
# they are changed by hand, offer managers who are also customers the customer groups on
# the New ticket screen, and let managers read the tickets of the sites assigned to them.
Rails.application.config.to_prepare do
  Ticket.include(Studenthub::TicketApproval::TicketGuard) if !(Ticket < Studenthub::TicketApproval::TicketGuard)
  Overview.include(Studenthub::TicketApproval::Setup::OverviewSync) if !(Overview < Studenthub::TicketApproval::Setup::OverviewSync)

  {
    TicketPolicy                    => Studenthub::TicketApproval::TicketAccess::Policy,
    TicketPolicy::BaseScope         => Studenthub::TicketApproval::TicketAccess::Scope,
    Escalation                      => Studenthub::TicketApproval::SlaPause::Escalation,
    Escalation::TicketBizBreak      => Studenthub::TicketApproval::SlaPause::TicketBizBreak,
    CoreWorkflow::Attributes::Group => Studenthub::TicketApproval::ManagerCreate::GroupOptions,
  }.each do |klass, extension|
    klass.prepend(extension) if klass.ancestors.exclude?(extension)
  end

  {
    TicketPolicy            => Studenthub::ManagerSites::Policy,
    TicketPolicy::BaseScope => Studenthub::ManagerSites::Scope,
  }.each do |klass, extension|
    klass.prepend(extension) if klass.ancestors.exclude?(extension)
  end
end
