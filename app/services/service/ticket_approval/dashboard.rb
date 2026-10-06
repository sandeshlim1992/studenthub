# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the manager dashboard in the new UI shows: the current user's own approvals.
# Only tickets the user can still read are counted or listed.
class Service::TicketApproval::Dashboard < Service::Base
  requires_current_user!

  DECISIONS_PERIOD = 30.days
  WAITING_WARNING  = 1.day # the oldest request turns amber after this
  STILL_OPEN_AFTER = 3.days
  LIST_LIMIT       = 5

  def execute
    {
      waiting:    waiting,
      decisions:  decisions,
      still_open: still_open,
      recent:     recent,
      settings:   {
        decisions_period_days: DECISIONS_PERIOD.in_days.to_i,
        waiting_warning_hours: WAITING_WARNING.in_hours.to_i,
        still_open_after_days: STILL_OPEN_AFTER.in_days.to_i,
      },
    }
  end

  private

  def readable(scope)
    scope.where(ticket_id: TicketPolicy::ReadScope.new(current_user).resolve.select(:id))
  end

  def decided_by_me
    readable(TicketApproval.where(decided_by_id: current_user.id, state: %w[approved denied]))
  end

  def waiting
    rounds = readable(TicketApproval.pending.where(approver_id: current_user.id))
    oldest = rounds.minimum(:created_at)

    { count: rounds.count, oldest_requested_at: oldest, overdue: oldest.present? && oldest < WAITING_WARNING.ago }
  end

  def decisions
    counts   = decided_by_me.where(decided_at: DECISIONS_PERIOD.ago..).group(:state).count
    approved = counts['approved'].to_i
    denied   = counts['denied'].to_i
    total    = approved + denied

    { approved:, denied:, approval_rate: total.zero? ? nil : (approved * 100.0 / total).round }
  end

  # Approved by me some days ago, and the ticket is still open (and still approved: a later
  # round may have changed that).
  def still_open
    rounds = decided_by_me.where(state: 'approved', decided_at: ...STILL_OPEN_AFTER.ago)
      .joins(:ticket)
      .where(tickets: { state_id: Ticket::State.by_category_ids(:open), approval_state: 'approved' })

    tickets = rounds.includes(ticket: :owner).reorder(:decided_at).to_a.uniq(&:ticket_id).first(LIST_LIMIT).map do |round|
      ticket_json(round).merge(decided_at: round.decided_at, owner: owner_name(round.ticket))
    end

    { count: rounds.distinct.count(:ticket_id), tickets: }
  end

  def recent
    decided_by_me.includes(:ticket, :requested_by).reorder(decided_at: :desc).limit(LIST_LIMIT).map do |round|
      ticket_json(round).merge(
        state:        round.state,
        comment:      round.comment,
        decided_at:   round.decided_at,
        requested_by: round.requested_by&.fullname,
      )
    end
  end

  def ticket_json(round)
    { ticket_id: round.ticket_id, number: round.ticket.number, title: round.ticket.title }
  end

  # User 1 is Zammad's "nobody" owner.
  def owner_name(ticket)
    ticket.owner_id == 1 ? nil : ticket.owner&.fullname
  end
end
