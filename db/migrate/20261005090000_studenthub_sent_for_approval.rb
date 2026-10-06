# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the agents' approval view becomes "Sent for approval" (their requests that wait
# for a decision; agent roles, not Managers), and both approval views follow the on/off switch.
class StudenthubSentForApproval < ActiveRecord::Migration[8.0]
  def up
    return if !Setting.exists?(name: 'ticket_approval')

    Studenthub::TicketApproval::Setup.create_overviews
    Overview.find_by(link: 'sent_for_approval')&.update!(
      condition: Studenthub::TicketApproval::Setup.agent_overview_attributes[:condition],
      role_ids:  Studenthub::TicketApproval::Setup.agent_role_ids,
    )
    Studenthub::TicketApproval::Setup.sync_overviews(Studenthub::TicketApproval.enabled?)
  end
end
