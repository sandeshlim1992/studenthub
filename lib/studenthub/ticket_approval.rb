# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: agents send a ticket to a manager for approval; the manager approves or
# denies it and the result goes back to the agent. See README → "Ticket Approvals".
module Studenthub::TicketApproval
  # Ticket columns that mirror the current approval round, so overviews and triggers can use them.
  COLUMNS = %w[approval_state approval_approver_id approval_requested_by_id].freeze
  STATES  = %w[pending approved denied].freeze

  APPROVER_PERMISSION = 'ticket.approver'.freeze
  MANAGER_ROLE        = 'Managers'.freeze

  def self.enabled?
    Setting.get('ticket_approval') == true
  end

  # Anyone holding the approver permission, which the Managers role carries.
  def self.managers
    User.with_permissions(APPROVER_PERMISSION).where(active: true).reorder(:firstname, :lastname)
  end

  def self.manager?(user)
    return false if !user&.active

    user.permissions?(APPROVER_PERMISSION)
  end

  # The approval columns may only change inside this block (see TicketGuard).
  def self.writing
    previous = Thread.current[:studenthub_ticket_approval_writing]
    Thread.current[:studenthub_ticket_approval_writing] = true
    yield
  ensure
    Thread.current[:studenthub_ticket_approval_writing] = previous
  end

  def self.writing?
    Thread.current[:studenthub_ticket_approval_writing] == true
  end
end
