# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'csv'

# Submitted feedback as CSV, with the same columns as the old PHP export.
class Service::FeedbackCollection::ExportCsv < Service::Base
  # Fixed file format, kept identical to the PHP export, so not translated.
  HEADERS = ['Date', 'Ticket Number', 'Agent', 'Customer Name', 'Customer Email', 'Rating', 'Comments'].freeze # rubocop:disable Zammad/DetectTranslatableString

  attr_reader :scope

  def initialize(scope: FeedbackRequest.submitted)
    @scope = scope
  end

  def execute
    CSV.generate do |csv|
      csv << HEADERS
      scope.reorder(rated_at: :desc, id: :desc).each do |row|
        csv << [
          row.rated_at&.in_time_zone(Setting.get('timezone_default').presence || 'UTC')&.strftime('%Y-%m-%d %H:%M'),
          row.ticket_number,
          row.owner_name,
          row.customer_name,
          row.customer_email,
          row.rating,
          sanitize(row.comments),
        ]
      end
    end
  end

  def self.filename
    "StudentHub_Feedback_#{Time.zone.today.iso8601}.csv"
  end

  private

  # Stops spreadsheet apps from running a comment that starts with = + - or @ as a formula.
  def sanitize(value)
    return value if value.blank?

    value.match?(%r{\A[=+\-@\t\r]}) ? "'#{value}" : value
  end
end
