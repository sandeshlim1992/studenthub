# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the newest ticket the student raised, for the mobile app's Home ("Your latest
# ticket"). Asked here, sorted by when it was created, because Zammad's My Tickets view may be
# grouped (by state, say), and its grouping comes before any order the app asks for. Only the
# student's own tickets count, never others' in a shared organisation, and not merged ones, as on
# the Tickets tab.
class Service::StudenthubCustomerTicket::Latest < Service::Base
  requires_current_user!

  def execute
    ticket = TicketPolicy::ReadScope.new(current_user).resolve
      .where(customer_id: current_user.id)
      .where.not(state_id: Ticket::State.by_category_ids(:merged))
      .reorder(created_at: :desc, id: :desc)
      .first
    return if !ticket

    {
      id:         ticket.id,
      number:     ticket.number,
      title:      ticket.title,
      updated_at: ticket.updated_at,
      state:      ticket.state.name,
      state_type: ticket.state.state_type.name,
    }
  end
end
