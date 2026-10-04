# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe TicketApprovalsController, aggregate_failures: true, type: :request do
  let(:group)   { create(:group) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:manager) { create_manager(firstname: 'Waliul', groups: [group]) }
  let(:ticket)  { create(:ticket, group:, state_name: 'open') }
  let(:url)     { "/api/v1/tickets/#{ticket.id}/approval" }

  before do
    Setting.set('ticket_approval', true)
    allow(NotificationFactory::Mailer).to receive(:notification)
  end

  describe 'the agent sending a ticket', authenticated_as: :agent do
    it 'lists managers and sends the ticket to one' do
      manager
      get url
      expect(json_response).to include('enabled' => true, 'state' => nil, 'can_request' => true)
      expect(json_response['managers']).to include(include('name' => manager.fullname, 'can_open_ticket' => true))

      post url, params: { approver_id: manager.id, reason: 'Please approve' }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response).to include('state' => 'pending', 'can_request' => false, 'can_cancel' => true, 'can_decide' => false)
      expect(json_response['current']).to include('reason' => 'Please approve')
    end

    it 'shows why a request is refused' do
      post url, params: { approver_id: manager.id, reason: '' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error']).to include('reason')
    end

    it 'withdraws a request' do
      post url, params: { approver_id: manager.id, reason: 'Please approve' }, as: :json
      delete url, as: :json

      expect(json_response).to include('state' => nil, 'can_request' => true)
    end
  end

  describe 'the manager deciding' do
    before do
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
    end

    it 'approves', authenticated_as: :manager do
      get url
      expect(json_response).to include('can_decide' => true)

      post "#{url}/approve", params: { comment: 'OK' }, as: :json
      expect(json_response).to include('state' => 'approved')
      expect(json_response['history'].first).to include('state' => 'approved', 'comment' => 'OK')
    end

    it 'needs a comment to deny', authenticated_as: :manager do
      post "#{url}/deny", params: { comment: '' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(ticket.reload.approval_state).to eq('pending')
    end

    it 'refuses anyone else', authenticated_as: :agent do
      post "#{url}/approve", as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error']).to include('Only the manager')
    end
  end

  describe 'ticket access' do
    it 'hides tickets the user cannot read', authenticated_as: -> { create(:agent) } do
      get url

      expect(response).to have_http_status(:forbidden)
    end

    it 'is not for customers', authenticated_as: -> { create(:customer) } do
      get url

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'admin switch' do
    it 'turns the feature and its overviews on and off', authenticated_as: -> { create(:admin) } do
      put '/api/v1/ticket_approval/settings', params: { enabled: false }, as: :json
      expect(json_response).to include('enabled' => false)
      expect(Overview.where(link: %w[awaiting_my_approval approval_decisions]).pluck(:active).uniq).to eq([false])

      put '/api/v1/ticket_approval/settings', params: { enabled: true }, as: :json
      expect(Studenthub::TicketApproval.enabled?).to be(true)
      expect(json_response['overviews'].pluck('active').uniq).to eq([true])
    end

    it 'is for admins only', authenticated_as: :agent do
      put '/api/v1/ticket_approval/settings', params: { enabled: false }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Studenthub::TicketApproval.enabled?).to be(true)
    end
  end
end
