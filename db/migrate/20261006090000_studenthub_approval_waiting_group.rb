# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: tickets wait for approval in the Managers group, where only the chosen manager
# (and the agent who asked) can see them, and their SLA can pause meanwhile. Each round keeps
# the team and owner to return the ticket to, and whether it paused the SLA.
class StudenthubApprovalWaitingGroup < ActiveRecord::Migration[8.0]
  def up
    return if !table_exists?(:ticket_approvals)

    add_round_columns
    Studenthub::TicketApproval::Setup.create_setting
    Studenthub::TicketApproval::WaitingGroup.ensure! if Studenthub::TicketApproval.enabled?
  end

  def down
    remove_column :ticket_approvals, :previous_group_id, if_exists: true
    remove_column :ticket_approvals, :previous_owner_id, if_exists: true
    remove_column :ticket_approvals, :sla_paused, if_exists: true
    TicketApproval.reset_column_information
    Setting.where(name: %w[ticket_approval_pause_sla ticket_approval_group_id]).destroy_all
  end

  private

  def add_round_columns
    if !column_exists?(:ticket_approvals, :previous_group_id)
      add_reference :ticket_approvals, :previous_group, type: :integer, null: true, foreign_key: { to_table: :groups, on_delete: :nullify }
    end
    if !column_exists?(:ticket_approvals, :previous_owner_id)
      add_reference :ticket_approvals, :previous_owner, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
    end
    add_column :ticket_approvals, :sla_paused, :boolean, null: false, default: false if !column_exists?(:ticket_approvals, :sla_paused)
    TicketApproval.reset_column_information
  end
end
