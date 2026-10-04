# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Stores a customer's rating. Each request can be answered once; the row lock stops two
# quick submits from both succeeding.
class Service::FeedbackCollection::SubmitFeedback < Service::Base
  class AlreadySubmittedError < StandardError; end
  class InvalidRatingError < StandardError; end

  COMMENTS_MAX_LENGTH = 5000

  attr_reader :feedback_request, :rating, :comments

  def initialize(feedback_request:, rating:, comments: nil)
    @feedback_request = feedback_request
    @rating           = Integer(rating.to_s, exception: false)
    @comments         = comments.to_s.strip.truncate(COMMENTS_MAX_LENGTH).presence
  end

  def execute
    raise InvalidRatingError, __('Please choose a rating from 1 to 5 stars.') if FeedbackRequest::RATINGS.exclude?(rating)

    FeedbackRequest.transaction do
      feedback_request.lock!
      raise AlreadySubmittedError, __('This feedback link has already been used.') if !feedback_request.awaiting_feedback?

      feedback_request.update!(rating:, comments:, rated_at: Time.zone.now, state: 'submitted', updated_by_id: 1)
    end

    add_internal_note
    notify
    feedback_request
  end

  def self.stars(rating)
    ('★' * rating.to_i) + ('☆' * (5 - rating.to_i))
  end

  private

  def config
    @config ||= FeedbackRequest.config
  end

  def add_internal_note
    return if !ActiveModel::Type::Boolean.new.cast(config[:add_internal_note])

    ticket = feedback_request.ticket
    return if !ticket

    body = "<p><strong>Customer feedback: #{self.class.stars(rating)} (#{rating}/5)</strong></p>"
    body += "<p>#{ERB::Util.html_escape(comments).gsub("\n", '<br>')}</p>" if comments

    # A system note on a closed ticket must not reopen it, fire triggers or notify agents.
    Transaction.execute(disable: %w[Transaction::Trigger Transaction::Notification Transaction::FeedbackCollection], disable_notification: true) do
      Ticket::Article.create!(
        ticket_id:     ticket.id,
        type:          Ticket::Article::Type.find_by(name: 'note'),
        sender:        Ticket::Article::Sender.find_by(name: 'System'),
        internal:      true,
        content_type:  'text/html',
        subject:       __('Customer feedback'),
        body:          body,
        preferences:   { feedback_request_id: feedback_request.id },
        updated_by_id: 1,
        created_by_id: 1,
      )
    end
  rescue => e
    # The rating is already saved; a failed note must not lose it.
    Rails.logger.error "Feedback Collection: could not add note to ticket #{feedback_request.ticket_id}: #{e.message}"
  end

  def notify # rubocop:disable Metrics/AbcSize
    return if config[:notify_email].blank?

    body = <<~TEXT
      Rating: #{rating}/5 #{self.class.stars(rating)}
      Ticket: ##{feedback_request.ticket_number} #{feedback_request.ticket_title}
      Customer: #{feedback_request.customer_name} <#{feedback_request.customer_email}>
      Agent: #{feedback_request.owner_name.presence || '-'}

      Comments:
      #{comments || '-'}
    TEXT

    Service::FeedbackCollection::DeliverRequest.deliver(
      Service::FeedbackCollection::DeliverRequest.delivery_channel!,
      to:           config[:notify_email],
      subject:      "Ticket ##{feedback_request.ticket_number}: #{rating}-Star Feedback",
      body:         body,
      content_type: 'text/plain',
      reply_to:     feedback_request.customer_email.presence,
    )
  rescue => e
    Rails.logger.error "Feedback Collection: could not send notification for request #{feedback_request.id}: #{e.message}"
  end
end
