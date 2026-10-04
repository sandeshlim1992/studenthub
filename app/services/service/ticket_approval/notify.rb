# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Tells the right people about an approval event, in the notification bell and by email.
#   requested  → the manager
#   decided    → the agent who asked, and the ticket owner if that is someone else
#   cancelled  → the manager (bell only)
class Service::TicketApproval::Notify < Service::Base
  TEMPLATES = { requested: 'ticket_approval_requested', decided: 'ticket_approval_decided' }.freeze

  attr_reader :approval, :event, :actor

  def initialize(approval:, event:, actor:)
    @approval = approval
    @event    = event.to_sym
    @actor    = actor
  end

  def execute
    recipients.each do |user|
      OnlineNotification.add(
        type:          'update',
        object:        'Ticket',
        o_id:          approval.ticket_id,
        seen:          false,
        user_id:       user.id,
        created_by_id: actor.id,
      )
      send_email(user)
    end
  end

  def recipients
    users = case event
            when :requested, :cancelled then [approval.approver]
            when :decided then [approval.requested_by, (approval.ticket.owner if approval.ticket.owner_id != 1)]
            else []
            end
    users.compact.uniq.select(&:active).reject { |user| user.id == actor.id }
  end

  private

  def send_email(user)
    template = TEMPLATES[event]
    return if !template || user.email.blank?

    NotificationFactory::Mailer.notification(
      template:    template,
      user:        user,
      objects:     { ticket: approval.ticket, recipient: user, current_user: actor, approval: approval },
      main_object: approval.ticket,
    )
  rescue => e
    # The bell notification is already there; a mail problem must not undo the approval.
    Rails.logger.error "Ticket Approvals: could not email #{user.id} about ticket #{approval.ticket_id}: #{e.message}"
  end
end
