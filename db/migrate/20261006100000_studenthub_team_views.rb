# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Teams views of the new UI, one per group with its open tickets, grouped by
# agent. Afterwards they follow the groups by themselves (Studenthub::TicketViews::Teams).
class StudenthubTeamViews < ActiveRecord::Migration[8.0]
  def up
    Studenthub::TicketViews::Teams.sync!
  end

  def down
    Studenthub::TicketViews::Teams.remove!
  end
end
