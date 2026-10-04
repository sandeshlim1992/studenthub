# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The chosen manager (or an admin) approves or denies a ticket.
class Service::TicketApproval::Decide < Service::TicketApproval::Base
  DECISIONS = %w[approved denied].freeze

  attr_reader :decision, :comment

  def initialize(ticket:, decision:, comment: nil)
    @ticket   = ticket
    @decision = decision.to_s
    @comment  = comment.to_s.strip.presence
  end

  def execute
    ensure_enabled!
    approval = current_round
    validate!(approval)

    write!(
      ticket_changes: { approval_state: decision },
      note:           {
        subject: decision == 'approved' ? __('Approved') : __('Denied'),
        body:    note_body,
      }
    ) do
      approval.update!(state: decision, comment: comment, decided_by_id: current_user.id, decided_at: Time.zone.now, updated_by_id: current_user.id)
    end

    Service::TicketApproval::Notify.execute(approval:, event: :decided, actor: current_user)
    approval
  end

  private

  def validate!(approval)
    raise Error, __('Unknown decision.') if DECISIONS.exclude?(decision)
    raise Error, __('This ticket is not waiting for approval.') if !approval || ticket.approval_state != 'pending'
    raise Error, __('Only the manager this ticket was sent to can decide.') if !may_decide?(approval)
    raise Error, __('Please say why the request is denied.') if decision == 'denied' && comment.blank?
    raise Error, __('The comment is too long.') if comment && comment.length > TicketApproval::TEXT_MAX_LENGTH
  end

  def note_body
    body = "<p><strong>#{decision == 'approved' ? 'Approved' : 'Denied'} by #{html(current_user.fullname)}</strong></p>"
    body += "<p>#{html(comment)}</p>" if comment
    body
  end

  def may_decide?(approval)
    approval.approver_id == current_user.id || current_user.permissions?('admin')
  end
end
