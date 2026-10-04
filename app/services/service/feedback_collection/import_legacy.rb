# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Imports feedback_tokens.json from the old PHP feedback.php add-on.
#
# The file is a JSON object keyed by token:
#   "b787eb27…": { "ticket": "884456", "title": "…", "email": "…", "owner": "…",
#                  "customer_name": "…", "used": true, "rating": "5",
#                  "comments": "Great help", "rated_at": "2026-03-18 12:29" }
#
# Tickets are matched by number where they exist; the raw values are kept either way.
# Unused tokens are imported as "sent", so links in old emails keep working once the
# old feedback.php address redirects to /feedback/<token>. Running it twice is safe.
class Service::FeedbackCollection::ImportLegacy < Service::Base
  # The PHP add-on's literal placeholder for "no comment"; data, not UI text.
  DEFAULT_COMMENT = 'No comments.'.freeze # rubocop:disable Zammad/DetectTranslatableString

  attr_reader :json, :result

  def initialize(json:)
    @json   = json
    @result = { imported: 0, submitted: 0, unused: 0, skipped_existing: 0, matched_tickets: 0, errors: [] }
  end

  def execute
    records = JSON.parse(json)
    raise ArgumentError, __('Expected a JSON object keyed by token.') if !records.is_a?(Hash)

    records.each { |token, record| import(token, record) }
    result
  end

  private

  def import(token, record)
    digest = FeedbackRequest.digest(token)
    if FeedbackRequest.exists?(token_digest: digest)
      result[:skipped_existing] += 1
      return
    end

    ticket = Ticket.find_by(number: record['ticket'].to_s)
    used   = ActiveModel::Type::Boolean.new.cast(record['used'])

    FeedbackRequest.create!(
      token_digest:  digest,
      source:        'import',
      sent_at:       nil,
      created_by_id: 1,
      updated_by_id: 1,
      **ticket_attributes(ticket, record),
      **answer_attributes(used, record),
    )

    result[:imported] += 1
    result[used ? :submitted : :unused] += 1
    result[:matched_tickets] += 1 if ticket
  rescue => e
    result[:errors] << "#{token.to_s.first(6)}…: #{e.message}"
  end

  def ticket_attributes(ticket, record)
    {
      ticket_id:      ticket&.id,
      ticket_number:  record['ticket'].to_s.presence || '?',
      ticket_title:   unescape(record['title']).to_s.truncate(250),
      customer_id:    ticket&.customer_id,
      customer_email: record['email'].to_s.truncate(255),
      customer_name:  unescape(record['customer_name']).to_s.truncate(150),
      owner_id:       ticket && ticket.owner_id != 1 ? ticket.owner_id : nil,
      owner_name:     unescape(record['owner']).to_s.truncate(150),
      group_id:       ticket&.group_id,
      group_name:     ticket&.group&.name.to_s.truncate(160),
    }
  end

  def answer_attributes(used, record)
    rated_at = parse_time(record['rated_at'])
    return { state: 'sent', created_at: rated_at || Time.zone.now } if !used

    rating = Integer(record['rating'].to_s, exception: false)
    {
      state:      'submitted',
      rating:     FeedbackRequest::RATINGS.include?(rating) ? rating : nil,
      comments:   comment(record['comments']),
      rated_at:   rated_at,
      created_at: rated_at || Time.zone.now,
    }
  end

  def comment(value)
    text = unescape(value).to_s.strip
    return if text.blank? || text == DEFAULT_COMMENT

    text
  end

  def unescape(value)
    return if value.nil?

    CGI.unescapeHTML(value.to_s)
  end

  # The PHP add-on stored local server time as "Y-m-d H:i".
  def parse_time(value)
    return if value.blank?

    zone = ActiveSupport::TimeZone[Setting.get('timezone_default').presence || 'Europe/London'] || Time.zone
    zone.strptime(value.to_s, '%Y-%m-%d %H:%M')
  rescue ArgumentError
    nil
  end
end
