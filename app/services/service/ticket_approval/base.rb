# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Shared helpers for the ticket approval services.
class Service::TicketApproval::Base < Service::Base
  # Shown to the user as-is (rendered as a 422 by TicketApprovalsController).
  class Error < StandardError; end

  requires_current_user!

  attr_reader :ticket

  private

  def ensure_enabled!
    raise Error, __('Ticket approvals are turned off.') if !Studenthub::TicketApproval.enabled?
  end

  def can_update_ticket?(user = current_user)
    user.permissions?('ticket.agent') && TicketPolicy.new(user, ticket).agent_update_access?
  rescue Pundit::NotAuthorizedError, Exceptions::Forbidden
    false
  end

  def current_round
    TicketApproval.pending.where(ticket_id: ticket.id).reorder(:id).last
  end

  # Updates the ticket's approval columns and adds an internal note in one Zammad
  # transaction, so triggers see the change (e.g. a Teams alert on "Approval is pending").
  # Agent notifications for it are sent by Notify instead of Zammad's generic ones.
  def write!(ticket_changes:, note:)
    Studenthub::TicketApproval.writing do
      Transaction.execute(disable_notification: true) do
        yield if block_given?
        ticket.update!(ticket_changes.merge(updated_by_id: current_user.id))
        Ticket::Article.create!(
          ticket_id:     ticket.id,
          type:          Ticket::Article::Type.find_by(name: 'note'),
          sender:        Ticket::Article::Sender.find_by(name: 'Agent'),
          internal:      true,
          content_type:  'text/html',
          subject:       note[:subject],
          body:          note[:body],
          preferences:   { ticket_approval: true },
          updated_by_id: current_user.id,
          created_by_id: current_user.id,
        )
      end
    end
  end

  def html(text)
    ERB::Util.html_escape(text.to_s).gsub("\n", '<br>')
  end
end
