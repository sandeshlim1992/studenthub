# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The agent who asked (or anyone who may change the ticket) withdraws a pending approval
# request; the ticket goes back to its team. With turned_off: true it is withdrawn because an
# admin turned Ticket Approvals off.
class Service::TicketApproval::Cancel < Service::TicketApproval::Base
  def initialize(ticket:, turned_off: false)
    @ticket     = ticket
    @turned_off = turned_off
  end

  def execute
    ensure_enabled! if !@turned_off
    approval = current_round
    raise Error, __('This ticket is not waiting for approval.') if !approval || ticket.approval_state != 'pending'
    raise Error, __('You need permission to change this ticket to withdraw the request.') if !@turned_off && !may_withdraw?(approval)

    write!(
      ticket_changes: {
        approval_state:           nil,
        approval_approver_id:     nil,
        approval_requested_by_id: nil,
        **Studenthub::TicketApproval::WaitingGroup.return_changes(ticket, approval),
      },
      note:           note
    ) do
      approval.update!(state: 'cancelled', decided_by_id: current_user.id, decided_at: Time.zone.now, updated_by_id: current_user.id)
    end

    Service::TicketApproval::Notify.execute(approval:, event: :cancelled, actor: current_user) if !@turned_off
    approval
  end

  private

  def may_withdraw?(approval)
    approval.requested_by_id == current_user.id || can_update_ticket?
  end

  def note
    if @turned_off
      return {
        subject: __('Approval request withdrawn'),
        body:    "<p><strong>Approval request withdrawn</strong>: #{html(current_user.fullname)} turned Ticket Approvals off.</p>",
      }
    end

    {
      subject: __('Approval request withdrawn'),
      body:    "<p><strong>Approval request withdrawn</strong> by #{html(current_user.fullname)}</p>",
    }
  end
end
