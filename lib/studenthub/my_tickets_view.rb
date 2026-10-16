# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: Zammad's "My Tickets" view (a student's own tickets: the new UI's ticket list and
# the mobile app's Tickets tab) lists the tickets in every state but merged. Zammad seeds it with
# the states that existed then, which leaves out Student Hub's own ("3. In Progress", "4.1 Pending /
# On Hold", "5. Resolved"); "is not merged" also takes in states added later. Its other conditions
# (the customer is the current user), order and columns stay. Idempotent; used by the
# 20261016100000 migration and Studenthub::Setup.ensure_all!.
module Studenthub::MyTicketsView
  LINK = 'my_tickets'.freeze

  def self.ensure!
    overview = Overview.find_by(link: LINK)
    return if !overview

    condition = overview.condition.merge(
      'ticket.state_id' => { 'operator' => 'is not', 'value' => Ticket::State.by_category_ids(:merged).map(&:to_s) }
    )
    return if condition == overview.condition

    overview.update!(condition:)
  end
end
