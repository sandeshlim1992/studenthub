# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub customer ticket column', :aggregate_failures, type: :request do
  let(:customer) { create(:customer) }
  let(:group)    { create(:group, follow_up_possible: 'yes') }
  let(:ticket)   { create(:ticket, customer:, group:, state_name: 'open', title: 'Laptop will not start') }

  def overview(ticket = self.ticket)
    get "/api/v1/studenthub/customer_tickets/#{ticket.id}", as: :json
  end

  describe 'GET /api/v1/studenthub/customer_tickets/:id', authenticated_as: :customer do
    let(:agent_article)    { create(:ticket_article, ticket:, sender_name: 'Agent', internal: false) }
    let(:internal_article) { create(:ticket_article, ticket:, sender_name: 'Agent', internal: true) }

    before do
      create(:store, object: 'Ticket::Article', o_id: agent_article.id, filename: 'form.pdf', preferences: { 'Content-Type' => 'application/pdf' })
      create(:store, object: 'Ticket::Article', o_id: internal_article.id, filename: 'internal.pdf')
    end

    it 'shows the summary, the progress, the shared files and what the student can do' do
      overview

      expect(response).to have_http_status(:ok)
      expect(json_response).to include('number' => ticket.number, 'team' => group.name, 'title' => 'Laptop will not start')
      expect(json_response['progress']).to eq('stage' => 'with_team', 'step' => 1)
      expect(json_response['files'].pluck('filename')).to eq(['form.pdf'])
      expect(json_response['files'].first).to include('from_team' => true, 'content_type' => 'application/pdf')
      expect(json_response['files'].first['url']).to eq("/api/v1/ticket_attachment/#{ticket.id}/#{agent_article.id}/#{json_response['files'].first['id']}?disposition=attachment")
      expect(json_response['actions']).to eq('can_close' => true, 'can_reopen' => false, 'new_ticket' => false)
      expect(json_response['feedback']).to be_nil
    end

    context 'with another student' do
      let(:ticket) { create(:ticket, customer: create(:customer), group:) }

      it 'refuses' do
        overview

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  context 'with an agent without the customer role', authenticated_as: :agent do
    let(:agent) { create(:agent, groups: [group]) }

    it 'refuses' do
      overview

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'progress stages' do
    let(:open_type) { Ticket::StateType.find_by(name: 'open') }

    def stage_for(state_name, state_type = open_type)
      state = Ticket::State.find_by(name: state_name) || create(:ticket_state, name: state_name, state_type:)

      Service::StudenthubCustomerTicket::Overview.stage(create(:ticket, customer:, group:, state:))
    end

    it 'reads the state type and the names of the site states' do
      expect(stage_for('new')).to eq('received')
      expect(stage_for('2. Assigned')).to eq('with_team')
      expect(stage_for('3. In Progress')).to eq('in_progress')
      expect(stage_for('4. Awaiting user Response')).to eq('waiting_for_you')
      expect(stage_for('pending reminder')).to eq('on_hold')
      expect(stage_for('5. Resolved')).to eq('resolved')
      expect(stage_for('closed')).to eq('closed')
    end
  end

  describe 'POST /api/v1/studenthub/customer_tickets/:id/close', authenticated_as: :customer do
    it 'closes the request without adding a message' do
      expect { post "/api/v1/studenthub/customer_tickets/#{ticket.id}/close", as: :json }.not_to change(Ticket::Article, :count)

      expect(response).to have_http_status(:ok)
      expect(ticket.reload.state.state_type.name).to eq('closed')
      expect(json_response['progress']).to eq('stage' => 'closed', 'step' => 4)
      expect(json_response['actions']).to include('can_close' => false, 'can_reopen' => true)
    end

    it 'refuses a closed request' do
      ticket.update!(state: Ticket::State.find_by(name: 'closed'))

      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/close", as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'POST /api/v1/studenthub/customer_tickets/:id/reopen', authenticated_as: :customer do
    let(:ticket) { create(:ticket, customer:, group:, state_name: 'closed') }

    it 'adds the message and reopens the request' do
      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/reopen", params: { message: "Still broken\nafter the update" }, as: :json

      expect(response).to have_http_status(:ok)
      article = ticket.articles.find_by(created_by_id: customer.id)
      expect(article).to have_attributes(internal: false)
      expect(article.sender.name).to eq('Customer')
      expect(article.body).to include('Still broken<br>after the update')
      expect(ticket.reload.state).to eq(Ticket::State.find_by(default_follow_up: true))
    end

    it 'needs a message' do
      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/reopen", params: { message: ' ' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(ticket.reload.state.name).to eq('closed')
    end

    context 'when the team takes no replies on closed tickets' do
      let(:group) { create(:group, follow_up_possible: 'new_ticket') }

      it 'offers a new ticket instead' do
        overview

        expect(json_response['actions']).to eq('can_close' => false, 'can_reopen' => false, 'new_ticket' => true)

        post "/api/v1/studenthub/customer_tickets/#{ticket.id}/reopen", params: { message: 'Still broken' }, as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end

    context 'with an open request' do
      let(:ticket) { create(:ticket, customer:, group:, state_name: 'open') }

      it 'refuses' do
        post "/api/v1/studenthub/customer_tickets/#{ticket.id}/reopen", params: { message: 'Hello' }, as: :json

        expect(response).to have_http_status(:unprocessable_content)
      end
    end
  end

  describe 'POST /api/v1/studenthub/customer_tickets/:id/rating', authenticated_as: :customer do
    let(:ticket) { create(:ticket, customer:, group:, state_name: 'closed') }
    let!(:feedback_request) { create(:feedback_request, ticket:, customer:) }

    before { Setting.set('feedback_collection', true) }

    it 'answers the feedback request' do
      overview
      expect(json_response['feedback']).to eq('state' => 'awaiting')

      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/rating", params: { rating: 4, comments: 'Quick help' }, as: :json

      expect(response).to have_http_status(:ok)
      expect(feedback_request.reload).to have_attributes(state: 'submitted', rating: 4, comments: 'Quick help')
      expect(json_response['feedback']).to include('state' => 'submitted', 'rating' => 4)

      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/rating", params: { rating: 5 }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'refuses a rating outside 1-5' do
      post "/api/v1/studenthub/customer_tickets/#{ticket.id}/rating", params: { rating: 9 }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(feedback_request.reload.state).to eq('sent')
    end

    context 'when the request was sent to someone else' do
      let!(:feedback_request) { create(:feedback_request, ticket:, customer: create(:customer)) }

      it 'does not offer it' do
        overview

        expect(json_response['feedback']).to be_nil
      end
    end
  end
end
