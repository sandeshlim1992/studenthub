# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: brings the Teams views up to date after a group, role or ticket state changed
# (Studenthub::TicketViews::Teams). One job at a time; changes made meanwhile are picked up by it.
class StudenthubTeamViewsSyncJob < ApplicationJob
  include HasActiveJobLock

  def perform
    Studenthub::TicketViews::Teams.sync!
  end
end
