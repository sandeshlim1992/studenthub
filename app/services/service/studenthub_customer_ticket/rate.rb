# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the student rates the support from the ticket screen instead of the emailed link.
# It answers the request Feedback Collection sent, so the rating is stored, noted on the ticket
# and reported exactly as one from the email.
class Service::StudenthubCustomerTicket::Rate < Service::Base
  requires_current_user!

  attr_reader :ticket, :rating, :comments

  def initialize(ticket:, rating:, comments: nil)
    @ticket   = ticket
    @rating   = rating
    @comments = comments
  end

  def self.latest_request(ticket)
    FeedbackRequest.where(ticket_id: ticket.id).reorder(created_at: :desc, id: :desc).first
  end

  # Only the student the request was sent to answers it, while Feedback Collection is on.
  def self.answerable?(request, ticket, user)
    return false if !request&.awaiting_feedback? || !FeedbackRequest.enabled?

    (request.customer_id || ticket.customer_id) == user.id
  end

  def execute
    request = self.class.latest_request(ticket)
    raise Exceptions::UnprocessableContent, __('There is no feedback request to answer for this ticket.') if !self.class.answerable?(request, ticket, current_user)

    Service::FeedbackCollection::SubmitFeedback.execute(feedback_request: request, rating:, comments:)
  rescue Service::FeedbackCollection::SubmitFeedback::InvalidRatingError,
         Service::FeedbackCollection::SubmitFeedback::AlreadySubmittedError => e
    raise Exceptions::UnprocessableContent, e.message
  end
end
