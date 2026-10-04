# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class FeedbackRequestSendJob < ApplicationJob
  retry_on StandardError, attempts: 5, wait: lambda { |executions|
    executions * 5.minutes
  }

  def perform(feedback_request_id)
    feedback_request = FeedbackRequest.find_by(id: feedback_request_id)
    return if !feedback_request
    return if %w[pending failed].exclude?(feedback_request.state)

    Service::FeedbackCollection::DeliverRequest.execute(feedback_request:)
  end
end
