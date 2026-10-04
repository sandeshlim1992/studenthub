# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Decides whether a closed ticket gets a feedback request and, if so, records it and
# queues the email. Called from Transaction::FeedbackCollection.
class Service::FeedbackCollection::RequestFeedback < Service::Base
  attr_reader :ticket, :config

  def initialize(ticket:)
    @ticket = ticket
    @config = FeedbackRequest.config
  end

  def execute
    return if !FeedbackRequest.enabled?
    return if !eligible?

    feedback_request = FeedbackRequest.create!(snapshot)
    FeedbackRequestSendJob.perform_later(feedback_request.id)
    feedback_request
  end

  private

  def eligible?
    customer = ticket.customer
    return false if !customer || customer.id == 1 || customer.email.blank?
    return false if recently_requested?

    matches_condition?
  end

  def recently_requested?
    days = config[:resend_after_days].to_i
    return false if days <= 0

    FeedbackRequest.where(ticket_id: ticket.id).exists?(created_at: days.days.ago..)
  end

  def matches_condition?
    condition = FeedbackRequest.condition(config)
    return true if condition.blank?

    count, = Ticket.selectors(condition, limit: 1, access: 'ignore', ticket_id: ticket.id)
    count.to_i.positive?
  end

  def snapshot
    customer = ticket.customer
    owner    = ticket.owner_id == 1 ? nil : ticket.owner

    {
      ticket_id:      ticket.id,
      ticket_number:  ticket.number,
      ticket_title:   ticket.title.to_s.truncate(250),
      customer_id:    customer.id,
      customer_email: customer.email,
      customer_name:  customer.firstname.to_s.truncate(150),
      owner_id:       owner&.id,
      owner_name:     owner&.firstname.to_s.truncate(150),
      group_id:       ticket.group_id,
      group_name:     ticket.group&.name.to_s.truncate(160),
      state:          'pending',
      source:         'native',
      created_by_id:  1,
      updated_by_id:  1,
    }
  end
end
