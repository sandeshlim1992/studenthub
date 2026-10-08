# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: "Still not fixed? Reopen". The student says what is still wrong; the message is
# added to the conversation and the ticket goes back to the follow-up state, as a reply on
# Zammad's customer form does. Whether a closed ticket can be reopened is the team's setting.
class Service::StudenthubCustomerTicket::Reopen < Service::Base
  requires_current_user!

  MESSAGE_MAX_LENGTH = 10_000

  attr_reader :ticket, :message

  def initialize(ticket:, message:)
    @ticket  = ticket
    @message = message.to_s.strip
  end

  def self.follow_up_state
    Ticket::State.where(active: true).find_by(default_follow_up: true) ||
      Ticket::State.by_category(:open).where(active: true).reorder(:id).first
  end

  def execute
    raise Exceptions::UnprocessableContent, __('Please tell us what is still not working.') if message.blank?
    raise Exceptions::UnprocessableContent, __('This request can no longer be reopened. Please raise a new one.') if !reopenable?

    Transaction.execute do
      Service::Ticket::Article::Create.with_current_user(current_user).execute(
        article_data: { body: body, content_type: 'text/html', type: 'web', internal: false },
        ticket:       ticket,
      )

      state = self.class.follow_up_state
      ticket.reload.with_lock { ticket.update!(state:) } if state && ticket.state_id != state.id
    end

    ticket
  end

  private

  def reopenable?
    stage = Service::StudenthubCustomerTicket::Overview.stage(ticket)
    return false if %w[closed resolved].exclude?(stage)
    return false if ticket.state.state_type.name == 'merged'

    TicketPolicy.new(current_user, ticket).follow_up?
  end

  def body
    "<div>#{ERB::Util.html_escape(message.truncate(MESSAGE_MAX_LENGTH)).gsub(%r{\r?\n}, '<br>')}</div>"
  end
end
