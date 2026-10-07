# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: ticket states for the new UI's Ticket States page, with how many tickets use each (only
# unused ones can be deleted) and the state types a state can have. Saved with /api/v1/ticket_states.
class Service::StudenthubTicketFields::States < Service::Base
  def execute
    counts = Ticket.group(:state_id).count

    {
      states:      Ticket::State.reorder(:name).map do |state|
        {
          id:                state.id,
          name:              state.name,
          state_type_id:     state.state_type_id,
          state_type:        state.state_type&.name,
          next_state_id:     state.next_state_id,
          ignore_escalation: state.ignore_escalation,
          default_create:    state.default_create,
          default_follow_up: state.default_follow_up,
          active:            state.active,
          note:              state.note,
          ticket_count:      counts[state.id] || 0,
        }
      end,
      state_types: Ticket::StateType.reorder(:id).map { |type| { id: type.id, name: type.name } },
    }
  end
end
