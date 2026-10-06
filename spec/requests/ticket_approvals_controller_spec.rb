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
      expect(json_response['managers']).to include({ 'id' => manager.id, 'name' => manager.fullname })

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

  describe 'viewer' do
    it 'tells a managers-only user apart', authenticated_as: :manager do
      get '/api/v1/ticket_approval/viewer'
      expect(json_response).to eq('enabled' => true, 'manager_only' => true)
    end

    it 'is false for agents', authenticated_as: :agent do
      get '/api/v1/ticket_approval/viewer'
      expect(json_response).to eq('enabled' => true, 'manager_only' => false)
    end
  end

  describe 'managers for a new ticket', authenticated_as: :agent do
    it 'lists every manager, whatever the team' do
      manager
      other_manager = create_manager(firstname: 'Other')

      get '/api/v1/ticket_approval/managers'

      expect(json_response['enabled']).to be(true)
      expect(json_response['managers']).to include(
        { 'id' => manager.id, 'name' => manager.fullname },
        { 'id' => other_manager.id, 'name' => other_manager.fullname },
      )
    end
  end

  describe 'a waiting ticket' do
    let(:other_manager) { create_manager(groups: [group]) }

    before do
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
    end

    it 'opens for the chosen manager', authenticated_as: :manager do
      get "/api/v1/tickets/#{ticket.id}"

      expect(response).to have_http_status(:ok)
    end

    it 'is hidden from other managers and from the team', authenticated_as: :other_manager do
      get "/api/v1/tickets/#{ticket.id}"

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'manager dashboard' do
    let(:approved_ticket) { create(:ticket, group:, state_name: 'open') }

    before do
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket: approved_ticket, approver: manager, reason: 'Laptop')
      Service::TicketApproval::Decide.with_current_user(manager).execute(ticket: approved_ticket.reload, decision: 'approved', comment: 'Fine')
      TicketApproval.where(ticket_id: approved_ticket.id).update_all(decided_at: 4.days.ago)
    end

    it "sums up the manager's own approvals", authenticated_as: :manager do
      get '/api/v1/ticket_approval/dashboard'

      expect(response).to have_http_status(:ok)
      expect(json_response['waiting']).to include('count' => 1, 'overdue' => false)
      expect(json_response['decisions']).to include('approved' => 1, 'denied' => 0, 'approval_rate' => 100)
      expect(json_response['still_open']).to include('count' => 1)
      expect(json_response['still_open']['tickets'].first).to include('number' => approved_ticket.number)
      expect(json_response['recent'].first).to include('state' => 'approved', 'comment' => 'Fine', 'requested_by' => agent.fullname)
    end

    it 'is for managers only', authenticated_as: :agent do
      get '/api/v1/ticket_approval/dashboard'

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'admin switch' do
    it 'turns the feature and its overviews on and off', authenticated_as: -> { create(:admin) } do
      put '/api/v1/ticket_approval/settings', params: { enabled: false }, as: :json
      expect(json_response).to include('enabled' => false)
      expect(Overview.where(link: %w[awaiting_my_approval sent_for_approval]).pluck(:active).uniq).to eq([false])

      put '/api/v1/ticket_approval/settings', params: { enabled: true }, as: :json
      expect(Studenthub::TicketApproval.enabled?).to be(true)
      expect(json_response['overviews'].pluck('active').uniq).to eq([true])
    end

    it 'sends waiting tickets back to their teams when turned off', authenticated_as: -> { create(:admin) } do
      Service::TicketApproval::Request.with_current_user(agent).execute(ticket:, approver: manager, reason: 'Please approve')

      put '/api/v1/ticket_approval/settings', params: { enabled: false }, as: :json

      expect(ticket.reload).to have_attributes(group_id: group.id, approval_state: nil)
      expect(TicketApproval.last.state).to eq('cancelled')
    end

    it 'switches the SLA pause', authenticated_as: -> { create(:admin) } do
      Studenthub::TicketApproval::WaitingGroup.ensure!

      put '/api/v1/ticket_approval/settings', params: { pause_sla: false }, as: :json

      expect(json_response).to include('enabled' => true, 'pause_sla' => false)
      expect(json_response['group']).to include('name' => 'Managers')
    end

    it 'is for admins only', authenticated_as: :agent do
      put '/api/v1/ticket_approval/settings', params: { enabled: false }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Studenthub::TicketApproval.enabled?).to be(true)
    end
  end
end
