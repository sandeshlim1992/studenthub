# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub Scheduler (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }

  describe 'GET /api/v1/studenthub/automation/options' do
    before do
      create(:object_manager_attribute_tree_select, name: 'sh_campus', display: 'Campus', data_option: {
               options:    [{ name: 'LSST', value: 'LSST', children: [{ name: 'Wembley', value: 'LSST::Wembley' }] }],
               default:    '',
               null:       true,
               relation:   '',
               maxlength:  255,
               nulloption: true,
             })
      create(:webhook, name: 'Teams alert')
    end

    it 'gives states, priorities, teams, agents, webhooks and select fields with flattened options' do
      get '/api/v1/studenthub/automation/options', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['states'].pluck('name')).to include('new', 'open', 'closed')
      expect(json_response['priorities'].pluck('name')).to include('2 normal')
      expect(json_response['groups'].pluck('name')).to include('Users')
      expect(json_response['agents'].pluck('id')).to include(current_user.id)
      expect(json_response['webhooks'].pluck('name')).to include('Teams alert')

      campus = json_response['ticket_attributes'].find { |attribute| attribute['name'] == 'sh_campus' }
      expect(campus).to include('display' => 'Campus', 'data_type' => 'tree_select')
      expect(campus['options']).to eq([{ 'value' => 'LSST', 'label' => 'LSST' }, { 'value' => 'LSST::Wembley', 'label' => 'LSST › Wembley' }])
      expect(json_response['ticket_attributes'].pluck('name')).not_to include('state_id', 'group_id', 'approval_state')
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/automation/options', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # The Scheduler page saves through Zammad's jobs API; this is what it sends.
  describe 'saving a job from the page' do
    let(:closed)  { Ticket::State.find_by(name: 'closed') }
    let(:pending) { Ticket::State.find_by(name: 'pending reminder') }
    let(:webhook) { create(:webhook) }
    let(:payload) do
      {
        name:                 'Close stale pending tickets',
        object:               'Ticket',
        active:               true,
        note:                 'Made in the new UI',
        disable_notification: true,
        timeplan:             {
          days:    { Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false },
          hours:   { '9' => true, '17' => true },
          minutes: { '0' => true, '30' => true },
        },
        condition:            {
          'ticket.state_id'   => { operator: 'is', value: [pending.id.to_s] },
          'ticket.updated_at' => { operator: 'before (relative)', value: '5', range: 'day' },
          'ticket.tags'       => { operator: 'contains one not', value: 'closed-notified' },
        },
        perform:              {
          'ticket.state_id'      => { value: closed.id.to_s },
          'ticket.tags'          => { operator: 'add', value: 'closed-notified' },
          'notification.webhook' => { webhook_id: webhook.id.to_s },
          'article.note'         => { subject: 'Closed', body: 'Closed after 5 days.', internal: 'true' },
          'notification.email'   => { recipient: ['ticket_customer'], subject: 'Your ticket #{ticket.number}', body: '<p>We closed it.</p>' }, # rubocop:disable Lint/InterpolationCheck
        },
      }
    end

    it 'creates the job, runs at the chosen times and keeps the conditions and actions' do
      post '/api/v1/jobs', params: payload, as: :json

      expect(response).to have_http_status(:created)
      job = Job.find(json_response['id'])
      expect(job.timeplan['days']).to include('Mon' => true, 'Sat' => false)
      expect(job.condition['ticket.updated_at']).to include('operator' => 'before (relative)', 'value' => '5', 'range' => 'day')
      expect(job.perform['notification.email']['recipient']).to eq(['ticket_customer'])
      expect(job.next_run_at).to be_present

      put "/api/v1/jobs/#{job.id}", params: payload.merge(active: false, perform: payload[:perform].except('notification.email')), as: :json
      expect(response).to have_http_status(:ok)
      expect(job.reload.active).to be(false)
      expect(job.perform.keys).not_to include('notification.email')
    end

    it 'counts the tickets a condition matches now' do
      travel_to(6.days.ago) { create_list(:ticket, 2, state: pending) }
      create(:ticket, state: pending)

      post '/api/v1/tickets/selector', params: { condition: payload[:condition] }, as: :json

      expect(json_response['object_count']).to eq(2)
    end
  end
end
