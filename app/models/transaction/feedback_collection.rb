# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: asks for feedback when a ticket changes to a state of type "closed".
# Registered as an async transaction backend by the 20261003120000 migration, so it runs
# for manual closes and for closes made by schedulers (e.g. auto-close jobs) alike.
class Transaction::FeedbackCollection

=begin
  {
    object: 'Ticket',
    type: 'update',
    object_id: 123,
    changes: {
      'state_id' => [2, 4],
    },
    created_at: Time.zone.now,
    user_id: 123,
  },
=end

  def initialize(item, params = {})
    @item = item
    @params = params
  end

  def perform
    return if Setting.get('import_mode')
    return if !FeedbackRequest.enabled?
    return if @item[:object] != 'Ticket'
    return if @item[:type] != 'update'
    return if !closed_now?

    ticket = Ticket.lookup(id: @item[:object_id])
    return if !ticket
    return if ticket.state.state_type.name != 'closed'

    Service::FeedbackCollection::RequestFeedback.execute(ticket:)
  end

  private

  def closed_now?
    changes = @item[:changes] || {}
    state_change = changes['state_id'] || changes[:state_id]
    return false if state_change.blank?

    new_state = Ticket::State.lookup(id: state_change[1])
    new_state&.state_type&.name == 'closed'
  end
end
