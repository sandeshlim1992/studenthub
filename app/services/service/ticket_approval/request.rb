# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# An agent sends a ticket to a manager for approval.
class Service::TicketApproval::Request < Service::TicketApproval::Base
  attr_reader :approver, :reason

  def initialize(ticket:, approver:, reason:)
    @ticket   = ticket
    @approver = approver
    @reason   = reason.to_s.strip
  end

  def execute
    ensure_enabled!
    validate!

    approval = nil
    write!(
      ticket_changes: { approval_state: 'pending', approval_approver_id: approver.id, approval_requested_by_id: current_user.id },
      note:           {
        subject: __('Approval requested'),
        body:    "<p><strong>Approval requested from #{html(approver.fullname)}</strong> by #{html(current_user.fullname)}</p><p>#{html(reason)}</p>",
      }
    ) do
      approval = TicketApproval.create!(
        ticket_id:       ticket.id,
        requested_by_id: current_user.id,
        approver_id:     approver.id,
        state:           'pending',
        reason:          reason,
        created_by_id:   current_user.id,
        updated_by_id:   current_user.id,
      )
    end

    Service::TicketApproval::Notify.execute(approval:, event: :requested, actor: current_user)
    approval
  end

  private

  def validate!
    raise Error, __('You need permission to change this ticket to send it for approval.') if !can_update_ticket?
    raise Error, __('This ticket is already waiting for approval.') if ticket.approval_state == 'pending'
    raise Error, __('Please give a reason for the approval request.') if reason.blank?
    raise Error, __('The reason is too long.') if reason.length > TicketApproval::TEXT_MAX_LENGTH

    validate_approver!
  end

  def validate_approver!
    raise Error, __('Please choose a manager.') if !approver
    raise Error, __('The chosen user is not a manager.') if !Studenthub::TicketApproval.manager?(approver)
    raise Error, __('You cannot send a ticket to yourself for approval.') if approver.id == current_user.id

    return if can_read_ticket?(approver)

    raise Error, format(__("%s can't open tickets in the group \"%s\". Give the Managers role read access to that group first."), approver.fullname, ticket.group&.name)
  end
end
