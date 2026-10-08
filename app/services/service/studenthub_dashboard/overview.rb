# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the admins' dashboard (team overview). Open tickets by team, SLA deadlines, tickets
# without an agent, new and closed tickets of the last days, open tickets by site, how tickets
# came in, who is online, approvals waiting and the students' rating. "Open" is what the Teams and
# Sites views list (every state that isn't closed or merged), so a number matches its view.
class Service::StudenthubDashboard::Overview < Service::Base
  requires_current_user!

  TREND_DAYS   = 7
  CHANNEL_DAYS = 30
  RATING_DAYS  = 30
  CHANNELS     = %w[email phone web].freeze

  def execute
    Time.use_zone(timezone) do
      {
        open:       open_tickets,
        sla:        sla,
        unassigned: unassigned,
        trend:      trend,
        sites:      sites,
        channels:   channels,
        agents:     agents,
        approvals:  approvals,
        rating:     rating,
        settings:   {
          trend_days:                 TREND_DAYS,
          channel_days:               CHANNEL_DAYS,
          rating_days:                RATING_DAYS,
          escalation_warning_minutes: warning_minutes,
        },
      }
    end
  end

  private

  def timezone
    zone = Setting.get('timezone_default').presence
    zone && ActiveSupport::TimeZone[zone] ? zone : 'UTC'
  end

  def warning_minutes
    minutes = Setting.get('studenthub_escalation_warning_minutes').to_i
    minutes.positive? ? minutes : 60
  end

  def open_scope
    Ticket.where(state_id: Studenthub::TicketViews::Setup.open_state_ids.map(&:to_i))
  end

  def waiting_group_id
    return @waiting_group_id if defined?(@waiting_group_id)

    @waiting_group_id = Studenthub::TicketApproval::WaitingGroup.group_id
  end

  def today
    Time.zone.now.beginning_of_day
  end

  def view_link(link)
    Overview.exists?(link:, active: true) ? link : nil
  end

  def open_tickets
    groups = Group.where(id: open_scope.distinct.select(:group_id)).index_by(&:id)

    teams = open_scope.group(:group_id).count.filter_map do |group_id, count|
      group = groups[group_id]
      next if !group

      waiting = group.id == waiting_group_id
      {
        id:                   group.id,
        name:                 group.name_last,
        count:                count,
        waiting_for_approval: waiting,
        view_link:            waiting ? nil : view_link(Studenthub::TicketViews::Teams.link(group)),
      }
    end

    {
      total:         open_scope.count,
      created_today: Ticket.where(created_at: today..).count,
      closed_today:  Ticket.where(close_at: today..).count,
      teams:         teams.sort_by { |team| [-team[:count], team[:name].downcase] },
    }
  end

  # Zammad keeps the next deadline of a ticket in escalation_at; tickets on hold have none.
  def sla
    now = Time.zone.now
    soon = now + warning_minutes.minutes

    {
      overdue:  open_scope.where(escalation_at: ...now).count,
      due_soon: open_scope.where(escalation_at: now...soon).count,
      on_track: open_scope.where(escalation_at: soon..).count,
      none:     open_scope.where(escalation_at: nil).count,
    }
  end

  def unassigned
    scope = open_scope.where(owner_id: [nil, 1])
    scope = scope.where.not(group_id: waiting_group_id) if waiting_group_id

    { count: scope.count, oldest_created_at: scope.minimum(:created_at) }
  end

  def trend
    first   = (Time.zone.today - (TREND_DAYS - 1)).beginning_of_day
    created = per_day(Ticket.where(created_at: first..).pluck(:created_at))
    closed  = per_day(Ticket.where(close_at: first..).pluck(:close_at))

    (first.to_date..Time.zone.today).map do |date|
      { date: date.iso8601, created: created[date] || 0, closed: closed[date] || 0 }
    end
  end

  def per_day(times)
    times.map { |time| time.in_time_zone.to_date }.tally
  end

  def sites
    counts = open_scope.group(:organization_id).count

    list = Studenthub::TicketViews::Institutions.organizations.map do |organization|
      {
        id:        organization.id,
        name:      organization.name,
        count:     counts[organization.id] || 0,
        view_link: view_link(Studenthub::TicketViews::Institutions.link(organization)),
      }
    end

    { list: list.sort_by { |site| [-site[:count], site[:name].downcase] }, without_site: counts[nil] || 0 }
  end

  def channels
    names  = Ticket::Article::Type.pluck(:id, :name).to_h
    counts = Ticket.where(created_at: CHANNEL_DAYS.days.ago..).group(:create_article_type_id).count

    totals = counts.each_with_object(Hash.new(0)) do |(type_id, count), result|
      name = names[type_id]
      result[CHANNELS.include?(name) ? name : 'other'] += count
    end

    (CHANNELS + ['other']).map { |key| { key:, count: totals[key] } }
  end

  def agents
    members = Service::StudenthubMembers::List.execute

    { online: members.count { |member| member[:online] }, total: members.size }
  end

  def approvals
    return if !Studenthub::TicketApproval.enabled?

    { waiting: TicketApproval.pending.count, oldest_requested_at: TicketApproval.pending.minimum(:created_at) }
  end

  # Ratings are for admins with the Feedback Collection permission only.
  def rating
    return if !current_user.permissions?('admin.feedback_collection')

    scope = FeedbackRequest.submitted.where(rated_at: RATING_DAYS.days.ago..)
    return if !FeedbackRequest.enabled? && !scope.exists?

    { count: scope.count, average: scope.average(:rating)&.to_f&.round(1) }
  end
end
