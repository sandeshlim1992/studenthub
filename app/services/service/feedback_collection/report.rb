# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Summary of submitted ratings for the admin page: average, distribution, per agent,
# per group and per month, optionally limited to a date range (by rating date).
class Service::FeedbackCollection::Report < Service::Base
  MONTH_SQL = "TO_CHAR(rated_at, 'YYYY-MM')".freeze # rubocop:disable Zammad/DetectTranslatableString
  attr_reader :from, :to

  def initialize(from: nil, to: nil)
    @from = parse_date(from)&.beginning_of_day
    @to   = parse_date(to)&.end_of_day
  end

  def execute
    {
      from:         from&.to_date,
      to:           to&.to_date,
      requests:     requests_scope.count,
      responses:    scope.count,
      average:      average(scope),
      distribution: FeedbackRequest::RATINGS.index_with { |rating| scope.where(rating:).count },
      by_agent:     grouped(:owner_name),
      by_group:     grouped(:group_name),
      by_month:     by_month,
    }
  end

  def scope
    @scope ||= begin
      relation = FeedbackRequest.submitted
      relation = relation.where(rated_at: from..) if from
      relation = relation.where(rated_at: ..to) if to
      relation
    end
  end

  private

  # Requests sent in the same period, for the response rate.
  def requests_scope
    relation = FeedbackRequest.where(state: %w[sent submitted])
    relation = relation.where(created_at: from..) if from
    relation = relation.where(created_at: ..to) if to
    relation
  end

  def average(relation)
    value = relation.average(:rating)
    value&.to_f&.round(2)
  end

  def grouped(column)
    scope
      .group(column)
      .pluck(column, Arel.sql('COUNT(*)'), Arel.sql('AVG(rating)'))
      .map { |name, count, avg| { name: name.presence || '(none)', count: count, average: avg.to_f.round(2) } }
      .sort_by { |row| [-row[:count], row[:name]] }
  end

  def by_month
    scope
      .group(Arel.sql(MONTH_SQL))
      .pluck(Arel.sql(MONTH_SQL), Arel.sql('COUNT(*)'), Arel.sql('AVG(rating)'))
      .map { |month, count, avg| { month: month, count: count, average: avg.to_f.round(2) } }
      .sort_by { |row| row[:month].to_s }
  end

  def parse_date(value)
    return if value.blank?

    Date.iso8601(value.to_s)
  rescue Date::Error
    nil
  end
end
