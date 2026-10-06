# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the Approval tab in the ticket sidebar shows to the current user.
class Service::TicketApproval::Status < Service::TicketApproval::Base
  def initialize(ticket:)
    @ticket = ticket
  end

  def execute
    round      = current_round
    can_update = can_update_ticket?
    enabled    = Studenthub::TicketApproval.enabled?

    {
      enabled:     enabled,
      state:       ticket.approval_state,
      current:     round&.as_api_json,
      history:     TicketApproval.where(ticket_id: ticket.id).reorder(id: :desc).limit(10).map(&:as_api_json),
      can_request: enabled && can_update && ticket.approval_state != 'pending',
      can_cancel:  enabled && may_cancel?(round, can_update),
      can_decide:  enabled && may_decide?(round),
      managers:    can_update ? managers : [],
    }
  end

  private

  # The agent who asked can only read the ticket while it waits, but may withdraw the request.
  def may_cancel?(round, can_update)
    round.present? && (can_update || round.requested_by_id == current_user.id)
  end

  def may_decide?(round)
    round.present? && (round.approver_id == current_user.id || current_user.permissions?('admin'))
  end

  # Every manager: a waiting ticket is opened through the approval, not through group access.
  def managers
    Studenthub::TicketApproval.managers.where.not(id: current_user.id).map do |user|
      { id: user.id, name: user.fullname }
    end
  end
end
