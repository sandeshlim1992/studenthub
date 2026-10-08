# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: "I no longer need help". The student closes their own ticket, as Zammad's
# customer form allows. Only the state changes, without a message: a message from the student
# would set the ticket back to In Progress (trigger "Customer replied").
class Service::StudenthubCustomerTicket::Close < Service::Base
  requires_current_user!

  attr_reader :ticket

  def initialize(ticket:)
    @ticket = ticket
  end

  def self.closed_state
    Ticket::State.where(active: true).find_by(default_close: true) ||
      Ticket::State.by_category(:closed).where(active: true).reorder(:id).first
  end

  def execute
    raise Exceptions::Forbidden, __('Not authorized') if !TicketPolicy.new(current_user, ticket).update?
    raise Exceptions::UnprocessableContent, __('This request is already closed.') if ticket.state.state_type.name.in?(%w[closed merged])

    state = self.class.closed_state
    raise Exceptions::UnprocessableContent, __('There is no closed state to set.') if !state

    Transaction.execute do
      ticket.with_lock { ticket.update!(state:) }
    end

    ticket
  end
end
