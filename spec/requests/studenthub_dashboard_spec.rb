# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub dashboards', :aggregate_failures, type: :request do
  let(:group)   { create(:group, name: 'Service Desk Test') }
  let(:other)   { create(:group, name: 'VLE Test') }
  let(:admin)   { create(:admin, groups: [group, other]) }
  let(:agent)   { create(:agent, groups: [group]) }
  let(:site)    { create(:organization, name: 'Test College') }
  let(:student) { create(:customer, organization: site) }

  describe 'GET /api/v1/studenthub/dashboard/overview' do
    before do
      create(:ticket, group:, customer: student, owner: agent, state_name: 'open')
      create(:ticket, group:, customer: student, state_name: 'new')
      create(:ticket, group: other, owner: agent, state_name: 'open').update_columns(escalation_at: 1.hour.ago)
      create(:ticket, group:, state_name: 'closed')
    end

    it 'gives admins the team overview', authenticated_as: :admin do
      get '/api/v1/studenthub/dashboard/overview', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['open']['teams']).to include(
        include('name' => 'Service Desk Test', 'count' => 2, 'waiting_for_approval' => false),
        include('name' => 'VLE Test', 'count' => 1),
      )
      expect(json_response['open']['closed_today']).to be >= 1
      expect(json_response['sla']['overdue']).to be >= 1
      expect(json_response['unassigned']['count']).to be >= 1
      expect(json_response['sites']['list']).to include(include('name' => 'Test College', 'count' => 2))
      expect(json_response['trend'].size).to eq(7)
      expect(json_response['trend'].last['created']).to be >= 4
      expect(json_response['channels'].pluck('key')).to eq(%w[email phone web other])
      expect(json_response['agents']['total']).to be >= 1
      expect(json_response['approvals']).to be_nil
    end

    it 'adds the students rating and the approvals waiting when those are on', authenticated_as: :admin do
      Setting.set('feedback_collection', true)
      Setting.set('ticket_approval', true)
      create(:feedback_request, :submitted, rating: 4, rated_at: 1.day.ago)
      create(:feedback_request, :submitted, rating: 2, rated_at: 2.days.ago)

      get '/api/v1/studenthub/dashboard/overview', as: :json

      expect(json_response['rating']).to eq('count' => 2, 'average' => 3.0)
      expect(json_response['approvals']).to include('waiting' => 0)
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/dashboard/overview', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'GET /api/v1/studenthub/dashboard/activity' do
    let(:ticket) { create(:ticket, group:, customer: student, title: 'Laptop will not start') }

    it 'lists ticket activity as who did what', authenticated_as: :agent do
      ticket.activity_stream_log('create', agent.id, true)
      create(:ticket_article, ticket:, sender_name: 'Customer', internal: false).activity_stream_log('create', student.id, true)

      get '/api/v1/studenthub/dashboard/activity', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['items']).to include(
        include('action' => 'created', 'ticket' => include('number' => ticket.number, 'title' => 'Laptop will not start'), 'actor' => include('name' => agent.fullname)),
        include('action' => 'wrote', 'actor' => include('name' => student.fullname)),
      )
    end

    it 'leaves out activity that is not about a ticket', authenticated_as: :admin do
      ticket.activity_stream_log('update', admin.id, true)
      create(:customer).activity_stream_log('create', admin.id, true)

      get '/api/v1/studenthub/dashboard/activity', as: :json

      expect(json_response['items']).to be_present
      expect(json_response['items']).to all(include('ticket' => include('id')))
    end

    it 'refuses students', authenticated_as: :student do
      get '/api/v1/studenthub/dashboard/activity', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'GET /api/v1/studenthub/dashboard/unassigned' do
    let(:hidden) { create(:group, name: 'Estates Test') }

    before do
      [group, other, hidden].each(&:touch)
      Studenthub::TicketViews::Teams.sync!
      create(:ticket, group:, title: 'Oldest one', state_name: 'new', created_at: 3.days.ago)
      create(:ticket, group:, title: 'Overdue one', state_name: 'open', created_at: 1.day.ago).update_columns(escalation_at: 1.hour.ago)
      create(:ticket, group:, title: 'Newest one', state_name: 'new', created_at: 1.hour.ago)
      create(:ticket, group:, title: 'Too new to list', state_name: 'new')
      create(:ticket, group:, owner: agent, state_name: 'open')
      create(:ticket, group:, state_name: 'closed')
      create(:ticket, group: hidden, state_name: 'new')
    end

    it 'lists the unassigned open tickets of the agent’s own teams, oldest first', authenticated_as: :agent do
      get '/api/v1/studenthub/dashboard/unassigned', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['teams'].pluck('name')).to eq(['Service Desk Test'])

      team = json_response['teams'].first
      expect(team).to include('count' => 4, 'overdue' => 1, 'view_link' => Studenthub::TicketViews::Teams.link(group))
      expect(team['oldest'].pluck('title')).to eq(['Oldest one', 'Overdue one', 'Newest one'])
    end

    it 'keeps teams with nothing unassigned', authenticated_as: :admin do
      get '/api/v1/studenthub/dashboard/unassigned', as: :json

      expect(json_response['teams']).to include(include('name' => 'VLE Test', 'count' => 0, 'oldest' => []))
    end

    it 'refuses students', authenticated_as: :student do
      get '/api/v1/studenthub/dashboard/unassigned', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
