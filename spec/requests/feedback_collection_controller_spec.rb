# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe FeedbackCollectionController, aggregate_failures: true, type: :request do
  let(:admin)    { create(:admin) }
  let(:agent)    { create(:agent) }
  let(:customer) { create(:customer) }

  describe 'GET /api/v1/feedback_collection/requests', authenticated_as: :admin do
    before do
      create(:feedback_request, :submitted, ticket_number: '1001', rating: 5, customer_name: 'Amira', rated_at: 3.days.ago)
      create(:feedback_request, :submitted, ticket_number: '1002', rating: 2, customer_name: 'Jane', rated_at: 1.day.ago)
      create(:feedback_request, ticket_number: '1003')
    end

    it 'lists submitted feedback, newest first' do
      get '/api/v1/feedback_collection/requests'

      expect(response).to have_http_status(:ok)
      expect(json_response).to include('total' => 2, 'page' => 1, 'per_page' => 25)
      expect(json_response['items'].pluck('ticket_number')).to eq(%w[1002 1001])
    end

    it 'sorts, filters and searches' do
      get '/api/v1/feedback_collection/requests', params: { sort_by: 'rating', order_by: 'asc' }
      expect(json_response['items'].pluck('rating')).to eq([2, 5])

      get '/api/v1/feedback_collection/requests', params: { rating: 5 }
      expect(json_response['items'].pluck('ticket_number')).to eq(%w[1001])

      get '/api/v1/feedback_collection/requests', params: { query: 'jan' }
      expect(json_response['items'].pluck('customer_name')).to eq(%w[Jane])

      get '/api/v1/feedback_collection/requests', params: { state: 'sent' }
      expect(json_response['items'].pluck('ticket_number')).to eq(%w[1003])
    end

    it 'paginates with an allowed page size' do
      get '/api/v1/feedback_collection/requests', params: { per_page: 10, page: 2 }

      expect(json_response).to include('per_page' => 10, 'page' => 2, 'items' => [])
    end

    it 'never exposes token digests' do
      get '/api/v1/feedback_collection/requests'

      expect(response.body).not_to include('token')
    end

    context 'with agent permissions', authenticated_as: :agent do
      it 'is forbidden' do
        get '/api/v1/feedback_collection/requests'

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'DELETE /api/v1/feedback_collection/requests/:id', authenticated_as: :admin do
    it 'deletes the entry' do
      row = create(:feedback_request, :submitted)

      expect { delete "/api/v1/feedback_collection/requests/#{row.id}" }.to change(FeedbackRequest, :count).by(-1)
    end
  end

  describe 'GET /api/v1/feedback_collection/export', authenticated_as: :admin do
    it 'downloads a CSV of submitted feedback' do
      create(:feedback_request, :submitted, ticket_number: '1001')

      get '/api/v1/feedback_collection/export'

      expect(response.headers['Content-Disposition']).to include('attachment', 'StudentHub_Feedback_')
      expect(response.body.lines.first).to start_with('Date,Ticket Number,Agent')
      expect(response.body).to include('1001')
    end
  end

  describe 'GET /api/v1/feedback_collection/report', authenticated_as: :admin do
    it 'returns the summary' do
      create(:feedback_request, :submitted, rating: 4)

      get '/api/v1/feedback_collection/report'

      expect(json_response).to include('responses' => 1, 'average' => 4.0)
    end
  end

  describe 'settings', authenticated_as: :admin do
    let(:channel) { create(:email_channel) }

    it 'returns the settings with channels, groups and the default template' do
      channel
      get '/api/v1/feedback_collection/settings'

      expect(json_response).to include('enabled' => false, 'placeholders' => include('link_5'))
      expect(json_response['channels'].pluck('id')).to include(channel.id)
      expect(json_response['default_template']).to include('{{link_1}}')
    end

    it 'saves valid settings and turns the feature on' do
      put '/api/v1/feedback_collection/settings', params: {
        enabled: true,
        subject: 'How did we do? #{{ticket_number}}',
        config:  { channel_id: channel.id, from_email: 'feedback@example.com', from_name: 'Feedback', group_ids: ['1'], skip_tags: %w[spam test], resend_after_days: '7', require_owner: 'false' },
      }, as: :json

      expect(response).to have_http_status(:ok)
      expect(FeedbackRequest.enabled?).to be(true)
      expect(FeedbackRequest.config).to include(channel_id: channel.id, from_email: 'feedback@example.com', group_ids: [1], skip_tags: %w[spam test], resend_after_days: 7, require_owner: false)
      expect(Setting.get('feedback_collection_email_subject')).to eq('How did we do? #{{ticket_number}}')
    end

    it 'rejects invalid email addresses' do
      put '/api/v1/feedback_collection/settings', params: { config: { notify_email: 'not-an-email' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error']).to include('not-an-email')
    end

    it 'refuses to turn on without a channel and sender' do
      put '/api/v1/feedback_collection/settings', params: { enabled: true, config: { channel_id: nil, from_email: '' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(FeedbackRequest.enabled?).to be(false)
    end

    it 'stores the default template as blank so later updates to it apply' do
      put '/api/v1/feedback_collection/settings', params: { template: Service::FeedbackCollection::RenderEmail.default_template }, as: :json

      expect(Setting.get('feedback_collection_email_template')).to eq('')
    end

    it 'previews a template with sample values' do
      post '/api/v1/feedback_collection/preview', params: { subject: 'S {{ticket_number}}', template: '<b>{{customer_name}}</b>' }, as: :json

      expect(json_response).to eq('subject' => 'S 884512', 'body' => '<b>Amira</b>')
    end

    it 'reports a test email failure instead of crashing' do
      post '/api/v1/feedback_collection/test_email', params: { to: 'admin@example.com' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error']).to include('No email channel')
    end

    context 'with agent permissions', authenticated_as: :agent do
      it 'is forbidden' do
        put '/api/v1/feedback_collection/settings', params: { enabled: true }, as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'GET /api/v1/feedback_collection/tickets/:ticket_id' do
    let(:group)  { create(:group) }
    let(:agent)  { create(:agent, groups: [group]) }
    let(:ticket) { create(:ticket, group:) }

    before { create(:feedback_request, :submitted, ticket:, rating: 4, comments: 'Thanks') }

    it 'shows the rating to agents who can see the ticket', authenticated_as: :agent do
      get "/api/v1/feedback_collection/tickets/#{ticket.id}"

      expect(json_response['items']).to contain_exactly(include('rating' => 4, 'comments' => 'Thanks'))
    end

    it 'hides it from agents without access to the ticket', authenticated_as: -> { create(:agent) } do
      get "/api/v1/feedback_collection/tickets/#{ticket.id}"

      expect(response).to have_http_status(:forbidden)
    end

    it 'hides it from customers', authenticated_as: :customer do
      get "/api/v1/feedback_collection/tickets/#{ticket.id}"

      expect(response).to have_http_status(:forbidden)
    end
  end
end
