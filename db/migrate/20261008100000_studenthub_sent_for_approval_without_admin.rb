# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: "Sent for approval" is no longer given to the Admin role (an agent role since the Teams
# views); admins who send requests get it through their agent role.
class StudenthubSentForApprovalWithoutAdmin < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::TicketApproval::Setup.sync_overviews
  end
end
