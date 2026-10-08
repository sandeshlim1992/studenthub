# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the manager dashboard in the new UI shows: the current user's own approvals.
# Only tickets the user can still read are counted or listed.
class Service::TicketApproval::Dashboard < Service::Base
  requires_current_user!

  DECISIONS_PERIOD = 30.days
  WAITING_WARNING  = 1.day # the oldest request turns amber after this
  STILL_OPEN_AFTER = 3.days
  LIST_LIMIT       = 5
  WEEKS            = 5
  MESSAGE_LENGTH   = 400

  def execute
    {
      waiting:    waiting,
      decisions:  decisions,
      month:      month,
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

  # The requests themselves, oldest first, with what the manager needs to decide.
  def waiting
    rounds = readable(TicketApproval.pending.where(approver_id: current_user.id))
    oldest = rounds.minimum(:created_at)

    requests = rounds.includes(:requested_by, :previous_group, ticket: :customer).reorder(:created_at).map do |round|
      waiting_json(round)
    end

    { count: requests.size, oldest_requested_at: oldest, overdue: oldest.present? && oldest < WAITING_WARNING.ago, requests: }
  end

  def waiting_json(round)
    ticket = round.ticket

    ticket_json(round).merge(
      reason:         round.reason,
      requested_at:   round.created_at,
      requested_by:   round.requested_by&.fullname,
      team:           round.previous_group&.name,
      customer:       ticket.customer&.fullname,
      campus:         ticket_attribute(ticket, 'campus'),
      category:       ticket_category(ticket),
      sla_paused:     round.sla_paused,
      latest_message: latest_message(ticket),
    )
  end

  def decisions
    counts   = decided_by_me.where(decided_at: DECISIONS_PERIOD.ago..).group(:state).count
    approved = counts['approved'].to_i
    denied   = counts['denied'].to_i
    total    = approved + denied

    { approved:, denied:, approval_rate: total.zero? ? nil : (approved * 100.0 / total).round }
  end

  # "Your month in review": how long requests waited for the manager, compared with the
  # period before, per week and per team.
  def month
    current  = decided_by_me.where(decided_at: DECISIONS_PERIOD.ago..)
    previous = decided_by_me.where(decided_at: (DECISIONS_PERIOD * 2).ago...DECISIONS_PERIOD.ago)
    waits    = wait_seconds(current)

    {
      decided:              waits.size,
      median_wait_seconds:  median(waits),
      longest_wait_seconds: waits.max,
      over_warning:         waits.count { |seconds| seconds > WAITING_WARNING.to_i },
      previous:             { decided: previous.count, median_wait_seconds: median(wait_seconds(previous)) },
      per_week:             per_week,
      by_team:              by_team(current),
    }
  end

  def wait_seconds(scope)
    scope.pluck(:created_at, :decided_at).map { |requested_at, decided_at| (decided_at - requested_at).to_i }
  end

  def median(values)
    return if values.empty?

    sorted = values.sort
    middle = sorted.size / 2
    sorted.size.odd? ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
  end

  # The last WEEKS calendar weeks (Monday to Sunday), this week included.
  def per_week
    first     = Time.zone.today.beginning_of_week - (WEEKS - 1).weeks
    decisions = decided_by_me.where(decided_at: first.beginning_of_day..).pluck(:decided_at, :state)

    Array.new(WEEKS) do |index|
      week_start = first + index.weeks
      in_week    = decisions.select { |decided_at, _| decided_at.in_time_zone.to_date.between?(week_start, week_start + 6.days) }

      {
        week_start:,
        approved:   in_week.count { |_, state| state == 'approved' },
        denied:     in_week.count { |_, state| state == 'denied' },
      }
    end
  end

  # The team is where the ticket came from (it waits in the Managers group meanwhile).
  def by_team(scope)
    scope.includes(:previous_group).group_by { |round| round.previous_group&.name }.map do |name, rounds|
      { name:, decided: rounds.size, approved: rounds.count { |round| round.state == 'approved' } }
    end.sort_by { |team| -team[:decided] }
  end

  # Approved by me some days ago, and the ticket is still open (and still approved: a later
  # round may have changed that).
  def still_open
    rounds = decided_by_me.where(state: 'approved', decided_at: ...STILL_OPEN_AFTER.ago)
      .joins(:ticket)
      .where(tickets: { state_id: Ticket::State.by_category_ids(:open), approval_state: 'approved' })

    tickets = rounds.includes(ticket: %i[owner state]).reorder(:decided_at).to_a.uniq(&:ticket_id).first(LIST_LIMIT).map do |round|
      ticket_json(round).merge(decided_at: round.decided_at, owner: owner_name(round.ticket), state: round.ticket.state.name)
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

  # Student Hub's own ticket fields; they don't exist on every system (e.g. in tests).
  def ticket_attribute(ticket, name)
    ticket.attributes[name].presence
  end

  def ticket_category(ticket)
    parts = [ticket_attribute(ticket, 'category2'), ticket_attribute(ticket, 'subcategory')].compact
    parts.join(' › ').presence
  end

  # The customer's latest message the agents can see (not internal).
  def latest_message(ticket)
    sender  = Ticket::Article::Sender.lookup(name: 'Customer')
    article = ticket.articles.where(internal: false, sender_id: sender&.id).reorder(created_at: :desc).first
    return if !article

    { from: article.created_by&.fullname, created_at: article.created_at, body: article_text(article) }
  end

  def article_text(article)
    text = article.content_type == 'text/html' ? article.body.to_s.html2text : article.body.to_s
    text.squish.truncate(MESSAGE_LENGTH)
  end

  # User 1 is Zammad's "nobody" owner.
  def owner_name(ticket)
    ticket.owner_id == 1 ? nil : ticket.owner&.fullname
  end
end
