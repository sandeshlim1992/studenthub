# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The Managers group: a system group of Ticket Approvals where tickets wait for a decision.
# Nobody has group access to it, so it is in nobody's Team list and only the users that
# TicketAccess lets in (the chosen manager, the agent who asked) see a waiting ticket.
module Studenthub::TicketApproval::WaitingGroup
  NAME    = 'Managers'.freeze
  SETTING = 'ticket_approval_group_id'.freeze
  NOTE    = __('Ticket Approvals: tickets wait here for a manager. Do not give anyone access to this group.').freeze

  def self.group
    Group.find_by(id: Setting.get(SETTING))
  end

  def self.group_id
    group&.id
  end

  # Creates the group (or takes over the existing Managers group), removes all access to it and
  # sends tickets that aren't waiting for approval back to their team. Safe to run again.
  def self.ensure!
    waiting = group || Group.find_by(name: NAME) || Group.create!(name: NAME, note: NOTE, active: true, created_by_id: 1, updated_by_id: 1)
    waiting.update!(active: true, note: NOTE, updated_by_id: 1) if !waiting.active || waiting.note != NOTE
    Setting.set(SETTING, waiting.id)

    remove_access!(waiting)
    return_other_tickets!(waiting)
    waiting
  end

  def self.remove_access!(waiting)
    RoleGroup.where(group_id: waiting.id).destroy_all
    UserGroup.where(group_id: waiting.id).destroy_all
  end

  # Tickets from the old approval process (moved here by hand) would be invisible now: return
  # each to the group it came from, as its history shows. Without one it stays and is logged.
  def self.return_other_tickets!(waiting)
    waiting_ids = TicketApproval.pending.select(:ticket_id)
    Ticket.where(group_id: waiting.id).where.not(id: waiting_ids).find_each do |ticket|
      target = previous_group(ticket, waiting)
      if !target
        Rails.logger.warn "Ticket Approvals: ticket #{ticket.number} stays in #{waiting.name}, no earlier group found"
        next
      end

      Transaction.execute(disable: %w[Transaction::Trigger Transaction::Notification], disable_notification: true, reset_user_id: true) do
        ticket.update!(group_id: target.id, updated_by_id: 1)
      end
    end
  end

  def self.previous_group(ticket, waiting)
    entry = History.list('Ticket', ticket.id)
      .reverse
      .find { |item| item['attribute'] == 'group' && item['id_to'].to_i == waiting.id && item['id_from'].present? }
    entry && Group.find_by(id: entry['id_from'].to_i, active: true)
  end

  # The ticket's changes when a request sends it here: the round remembers team and owner.
  def self.move_in_changes(ticket)
    waiting = group || ensure!
    return {} if ticket.group_id == waiting.id

    { group_id: waiting.id }
  end

  # The ticket's changes when the round ends: back to its team, with its owner if Zammad had
  # to clear the owner on the way in (an owner needs access to the ticket's group).
  def self.return_changes(ticket, approval)
    return {} if ticket.group_id != group_id
    return {} if !approval.previous_group_id || !Group.exists?(id: approval.previous_group_id, active: true)

    changes = { group_id: approval.previous_group_id }
    changes[:owner_id] = approval.previous_owner_id if approval.previous_owner_id && ticket.owner_id == 1
    changes
  end
end
