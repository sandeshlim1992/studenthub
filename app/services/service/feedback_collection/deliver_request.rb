# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Sends one feedback request email through the Zammad email channel chosen on the
# Feedback Collection admin page. A fresh token is generated for every attempt, so a
# token that never reached the customer can't be used.
class Service::FeedbackCollection::DeliverRequest < Service::Base
  class DeliveryError < StandardError; end

  attr_reader :feedback_request

  def initialize(feedback_request:)
    @feedback_request = feedback_request
  end

  def execute
    channel = self.class.delivery_channel!
    token   = feedback_request.regenerate_token!
    email   = Service::FeedbackCollection::RenderEmail.execute(
      values: Service::FeedbackCollection::RenderEmail.values_for(feedback_request, token)
    )

    self.class.deliver(channel, to: feedback_request.customer_email, **email)
    feedback_request.update!(state: 'sent', sent_at: Time.zone.now, error: nil, updated_by_id: 1)
  rescue => e
    feedback_request.update!(state: 'failed', error: e.message.to_s.truncate(500), updated_by_id: 1)
    raise
  end

  def self.delivery_channel!
    config  = FeedbackRequest.config
    channel = Channel.find_by(id: config[:channel_id])

    raise DeliveryError, __('No email channel is selected for feedback requests.') if !channel
    raise DeliveryError, "The email channel ##{channel.id} for feedback requests is not active." if !channel.active

    channel
  end

  def self.from_header
    config = FeedbackRequest.config
    raise DeliveryError, __('No sender address is set for feedback requests.') if config[:from_email].blank?

    address = Mail::Address.new(config[:from_email])
    address.display_name = config[:from_name] if config[:from_name].present?
    address.to_s
  end

  def self.deliver(channel, to:, subject:, body:, content_type: 'text/html', reply_to: nil)
    reply_to ||= FeedbackRequest.config[:reply_to].presence

    channel.deliver(
      {
        from:         from_header,
        to:           to,
        reply_to:     reply_to,
        subject:      subject,
        body:         body,
        content_type: content_type,
      }.compact,
      true
    )
  end
end
