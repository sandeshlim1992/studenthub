# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: a message from the chat box on the mobile ticket screen. It goes into the
# conversation as a reply on Zammad's customer form does. A resolved or closed request goes
# through Reopen, so the message also sets it back to the follow-up state.
class Service::StudenthubCustomerTicket::Reply < Service::Base
  requires_current_user!

  attr_reader :ticket, :message

  def initialize(ticket:, message:)
    @ticket  = ticket
    @message = message.to_s.strip
  end

  def execute
    return reopen if Service::StudenthubCustomerTicket::Overview.stage(ticket).in?(%w[closed resolved])

    raise Exceptions::UnprocessableContent, __('Please write a message.') if message.blank?
    # For customers Zammad's ticket rules answer with the fields they may not change, not true.
    raise Exceptions::Forbidden, __('Not authorized') if [false, nil].include?(TicketPolicy.new(current_user, ticket).update?)

    Transaction.execute do
      Service::Ticket::Article::Create.with_current_user(current_user).execute(
        article_data: { body: Service::StudenthubCustomerTicket::Reopen.body(message), content_type: 'text/html', type: 'web', internal: false },
        ticket:       ticket,
      )
    end

    ticket
  end

  private

  def reopen
    Service::StudenthubCustomerTicket::Reopen.with_current_user(current_user).execute(ticket:, message:)
  end
end
