# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: ticket approvals (agents send a ticket to a manager, who approves or denies it).
#
# No "new setup" guard, for the same reason as the Feedback Collection migration: Student Hub
# must not edit Zammad's base migration, so this runs on fresh and existing systems alike.
class StudenthubTicketApproval < ActiveRecord::Migration[8.0]
  def up
    create_ticket_approvals
    add_ticket_columns
    Studenthub::TicketApproval::Setup.ensure!
  end

  def down
    Studenthub::TicketApproval::Setup.remove!
    Studenthub::TicketApproval::COLUMNS.each { |column| remove_column :tickets, column, if_exists: true }
    Ticket.reset_column_information
    drop_table :ticket_approvals, if_exists: true
  end

  private

  def create_ticket_approvals
    return if table_exists?(:ticket_approvals)

    create_table :ticket_approvals, id: :integer do |t|
      t.references :ticket,       type: :integer, null: false, foreign_key: { on_delete: :cascade }
      t.references :requested_by, type: :integer, null: true,  foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :approver,     type: :integer, null: true,  foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :decided_by,   type: :integer, null: true,  foreign_key: { to_table: :users, on_delete: :nullify }
      t.string     :state, limit: 20, null: false, default: 'pending'
      t.text       :reason,  null: false
      t.text       :comment, null: true
      t.datetime   :decided_at, limit: 3, null: true
      t.references :created_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false

      t.index %i[approver_id state]
    end
  end

  # Plain columns without foreign keys, like Zammad's own custom ticket fields, so deleting
  # a user (e.g. a data privacy task) is never blocked by an old approval.
  def add_ticket_columns
    add_column :tickets, :approval_state, :string, limit: 20, null: true if !column_exists?(:tickets, :approval_state)
    add_column :tickets, :approval_approver_id, :integer, null: true if !column_exists?(:tickets, :approval_approver_id)
    add_column :tickets, :approval_requested_by_id, :integer, null: true if !column_exists?(:tickets, :approval_requested_by_id)
    add_index :tickets, %i[approval_approver_id approval_state], if_not_exists: true
    add_index :tickets, %i[approval_requested_by_id approval_state], if_not_exists: true
    Ticket.reset_column_information
  end
end
