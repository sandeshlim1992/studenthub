# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: ticket priorities for the new UI's Ticket Priorities page, with how many tickets use
# each (only unused ones can be deleted). Saved with /api/v1/ticket_priorities.
class Service::StudenthubTicketFields::Priorities < Service::Base
  def execute
    counts = Ticket.group(:priority_id).count

    {
      priorities: Ticket::Priority.reorder(:name).map do |priority|
        {
          id:             priority.id,
          name:           priority.name,
          ui_color:       priority.ui_color,
          ui_icon:        priority.ui_icon,
          default_create: priority.default_create,
          active:         priority.active,
          note:           priority.note,
          ticket_count:   counts[priority.id] || 0,
        }
      end,
    }
  end
end
