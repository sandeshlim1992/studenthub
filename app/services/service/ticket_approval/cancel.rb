# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# An agent withdraws a pending approval request.
class Service::TicketApproval::Cancel < Service::TicketApproval::Base
  def initialize(ticket:)
    @ticket = ticket
  end

  def execute
    ensure_enabled!
    approval = current_round
    raise Error, __('This ticket is not waiting for approval.') if !approval || ticket.approval_state != 'pending'
    raise Error, __('You need permission to change this ticket to withdraw the request.') if !can_update_ticket?

    write!(
      ticket_changes: { approval_state: nil, approval_approver_id: nil, approval_requested_by_id: nil },
      note:           {
        subject: __('Approval request withdrawn'),
        body:    "<p><strong>Approval request withdrawn</strong> by #{html(current_user.fullname)}</p>",
      }
    ) do
      approval.update!(state: 'cancelled', decided_by_id: current_user.id, decided_at: Time.zone.now, updated_by_id: current_user.id)
    end

    Service::TicketApproval::Notify.execute(approval:, event: :cancelled, actor: current_user)
    approval
  end
end
