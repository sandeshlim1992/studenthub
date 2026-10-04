# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Public feedback page linked from the feedback request email. No login: the token in
# the URL is the credential. Opening the page never saves anything, because mail
# scanners (e.g. Outlook Safe Links) open every link in an email; only the POST does.
class FeedbackController < ApplicationController
  layout 'feedback'

  skip_before_action :user_device_log, raise: false
  before_action :set_privacy_headers
  before_action :ensure_enabled
  before_action :load_feedback_request

  def show
    return render_invalid if !@feedback_request.awaiting_feedback?

    @rating = rating_param
    render :show
  end

  def submit
    Service::FeedbackCollection::SubmitFeedback.execute(
      feedback_request: @feedback_request,
      rating:           params[:rating],
      comments:         params[:comments],
    )

    redirect_to "/feedback/#{params[:token]}/thanks", status: :see_other
  rescue Service::FeedbackCollection::SubmitFeedback::InvalidRatingError => e
    @error    = e.message
    @rating   = nil
    @comments = params[:comments].to_s.truncate(Service::FeedbackCollection::SubmitFeedback::COMMENTS_MAX_LENGTH)
    render :show, status: :unprocessable_content
  rescue Service::FeedbackCollection::SubmitFeedback::AlreadySubmittedError
    render_invalid
  end

  def thanks
    return render_invalid if !@feedback_request.submitted?

    render :thanks
  end

  private

  def ensure_enabled
    return if FeedbackRequest.enabled?

    render :unavailable, status: :not_found
  end

  def load_feedback_request
    @feedback_request = FeedbackRequest.lookup_by_token(params[:token])
    render_invalid if !@feedback_request
  end

  def render_invalid
    render :invalid, status: :gone
  end

  def rating_param
    rating = Integer(params[:rating].to_s, exception: false)
    FeedbackRequest::RATINGS.include?(rating) ? rating : nil
  end

  def set_privacy_headers
    response.headers['X-Robots-Tag']    = 'noindex, nofollow'
    response.headers['Referrer-Policy'] = 'no-referrer'
    response.headers['Cache-Control']   = 'no-store'
  end
end
