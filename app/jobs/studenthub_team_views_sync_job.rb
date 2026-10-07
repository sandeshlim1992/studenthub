# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: brings the views Student Hub manages up to date after a group, organisation, role,
# ticket state or one of these overviews changed: the Teams views (Studenthub::TicketViews::Teams),
# the Institutions views (Studenthub::TicketViews::Institutions), the managers' site views
# (Studenthub::TicketViews::ManagerSites) and the Ticket Approvals overviews
# (Studenthub::TicketApproval::Setup.sync_overviews). One job at a time; changes made meanwhile are
# picked up by it.
class StudenthubTeamViewsSyncJob < ApplicationJob
  include HasActiveJobLock

  def perform
    Studenthub::TicketViews::Teams.sync!
    Studenthub::TicketViews::Institutions.sync!
    Studenthub::TicketViews::ManagerSites.sync!
    Studenthub::TicketApproval::Setup.sync_overviews
  end
end
