# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# What the "My sites" section of the manager dashboard shows: the numbers of each site assigned to
# the current manager (Studenthub::ManagerSites). Waiting means on hold (a pending state) or waiting
# for the customer (a state named "Awaiting …").
class Service::StudenthubManagerSites::Stats < Service::Base
  requires_current_user!

  NEW_PERIOD    = 7.days
  CLOSED_PERIOD = 30.days
  LIST_LIMIT    = 5

  def execute
    {
      sites:    Studenthub::ManagerSites.organizations_for(current_user).map { |organization| site(organization) },
      settings: { new_period_days: NEW_PERIOD.in_days.to_i, closed_period_days: CLOSED_PERIOD.in_days.to_i },
    }
  end

  private

  def site(organization)
    tickets = Ticket.where(organization_id: organization.id)
    open    = tickets.where(state_id: open_state_ids)

    {
      organization_id: organization.id,
      name:            organization.name,
      view_link:       Studenthub::TicketViews::ManagerSites.link(organization),
      open:            open.count,
      new:             tickets.where(created_at: NEW_PERIOD.ago..).count,
      waiting:         open.where(state_id: waiting_state_ids).count,
      escalated:       open.where(escalation_at: ..Time.zone.now).count,
      closed:          tickets.where(close_at: CLOSED_PERIOD.ago..).count,
      teams:           top(open.joins(:group).group('groups.name').count),
      categories:      Ticket.column_names.include?('category2') ? top(open.where.not(category2: [nil, '']).group(:category2).count) : [],
    }
  end

  def top(counts)
    counts.sort_by { |name, count| [-count, name.to_s] }.first(LIST_LIMIT).map { |name, count| { name: name, count: count } }
  end

  def open_state_ids
    @open_state_ids ||= Studenthub::TicketViews::Setup.open_state_ids.map(&:to_i)
  end

  def waiting_state_ids
    @waiting_state_ids ||= Ticket::State.joins(:state_type)
      .where(ticket_state_types: { name: ['pending reminder', 'pending action'] })
      .or(Ticket::State.where('ticket_states.name ILIKE ?', '%awaiting%'))
      .pluck(:id)
  end
end
