# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the Approval tab in the ticket sidebar shows to the current user.
class Service::TicketApproval::Status < Service::TicketApproval::Base
  def initialize(ticket:)
    @ticket = ticket
  end

  def execute
    round      = current_round
    can_update = can_update_ticket?

    {
      enabled:     Studenthub::TicketApproval.enabled?,
      state:       ticket.approval_state,
      current:     round&.as_api_json,
      history:     TicketApproval.where(ticket_id: ticket.id).reorder(id: :desc).limit(10).map(&:as_api_json),
      can_request: Studenthub::TicketApproval.enabled? && can_update && ticket.approval_state != 'pending',
      can_cancel:  Studenthub::TicketApproval.enabled? && can_update && round.present?,
      can_decide:  Studenthub::TicketApproval.enabled? && round.present? && (round.approver_id == current_user.id || current_user.permissions?('admin')),
      managers:    can_update ? managers : [],
    }
  end

  private

  def managers
    Studenthub::TicketApproval.managers.where.not(id: current_user.id).map do |user|
      { id: user.id, name: user.fullname, can_open_ticket: can_read_ticket?(user) }
    end
  end
end
