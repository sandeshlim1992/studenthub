# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe FeedbackController, aggregate_failures: true, authenticated_as: false, type: :request do
  let(:token)             { FeedbackRequest.generate_token }
  let(:ticket)            { create(:ticket, state_name: 'closed', title: 'Password Reset Request') }
  let!(:feedback_request) { create(:feedback_request, ticket:, token:, customer_name: 'Jane') }

  before { Setting.set('feedback_collection', true) }

  describe 'GET /feedback/:token' do
    it 'shows the form with the star from the email pre-selected' do
      get "/feedback/#{token}?rating=4"

      expect(response).to have_http_status(:ok)
      expect(response.body).to include('We Value Your Feedback', 'Hello Jane', 'Password Reset Request')
      expect(response.body).to include('id="rating-4" name="rating" value="4" checked')
      expect(response.headers['X-Robots-Tag']).to include('noindex')
    end

    it 'saves nothing, because mail scanners open links too' do
      get "/feedback/#{token}?rating=1"

      expect(feedback_request.reload).to have_attributes(state: 'sent', rating: nil)
    end

    it 'shows "Link Expired or Invalid" for an unknown token' do
      get "/feedback/#{'0' * 64}"

      expect(response).to have_http_status(:gone)
      expect(response.body).to include('Link Expired or Invalid')
    end

    it 'shows "Link Expired or Invalid" once the link was used' do
      feedback_request.update!(state: 'submitted', rating: 5, rated_at: Time.zone.now)
      get "/feedback/#{token}"

      expect(response).to have_http_status(:gone)
    end

    it 'says feedback is not available while the feature is off' do
      Setting.set('feedback_collection', false)
      get "/feedback/#{token}"

      expect(response).to have_http_status(:not_found)
      expect(response.body).to include("Feedback Isn't Available")
    end
  end

  describe 'POST /feedback/:token' do
    it 'saves the rating and shows the thank-you page' do
      post "/feedback/#{token}", params: { rating: '5', comments: 'Great help' }

      expect(response).to redirect_to("/feedback/#{token}/thanks")
      expect(feedback_request.reload).to have_attributes(state: 'submitted', rating: 5, comments: 'Great help')

      follow_redirect!
      expect(response.body).to include('Thank You!', "Ticket ##{ticket.number}")
    end

    it 'asks again when no star was chosen' do
      post "/feedback/#{token}", params: { comments: 'Forgot the stars' }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include('Please choose a rating', 'Forgot the stars')
      expect(feedback_request.reload.state).to eq('sent')
    end

    it 'refuses a second submission' do
      post "/feedback/#{token}", params: { rating: '5' }
      post "/feedback/#{token}", params: { rating: '1' }

      expect(response).to have_http_status(:gone)
      expect(feedback_request.reload.rating).to eq(5)
    end

    context 'with CSRF protection on' do
      around do |example|
        ActionController::Base.allow_forgery_protection = true
        example.run
      ensure
        ActionController::Base.allow_forgery_protection = false
      end

      it 'rejects a post without the form token' do
        post "/feedback/#{token}", params: { rating: '5' }

        expect(response).to have_http_status(:unauthorized)
        expect(feedback_request.reload.state).to eq('sent')
      end

      it 'accepts a post with the token from the form' do
        get "/feedback/#{token}"
        form_token = response.body[%r{name="authenticity_token" value="([^"]+)"}, 1]
        post "/feedback/#{token}", params: { rating: '3', authenticity_token: form_token }

        expect(feedback_request.reload).to have_attributes(state: 'submitted', rating: 3)
      end
    end
  end

  describe 'GET /feedback/:token/thanks' do
    it 'is only shown after feedback was given' do
      get "/feedback/#{token}/thanks"

      expect(response).to have_http_status(:gone)
    end
  end
end
