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
      expect(json_response['article_senders'].pluck('name')).to eq(%w[Agent Customer System])
      expect(json_response['article_types'].pluck('name')).to include('email', 'note', 'web')

      campus = json_response['ticket_attributes'].find { |attribute| attribute['name'] == 'sh_campus' }
      expect(campus).to include('display' => 'Campus', 'data_type' => 'tree_select')
      expect(campus['options']).to eq([{ 'value' => 'LSST', 'label' => 'LSST' }, { 'value' => 'LSST::Wembley', 'label' => 'LSST › Wembley' }])
      expect(json_response['ticket_attributes'].pluck('name')).not_to include('state_id', 'group_id', 'approval_state')
    end

    it 'gives roles, calendars and the fields of tickets, users and organisations with their types' do
      create(:calendar, name: 'Office hours')

      get '/api/v1/studenthub/automation/options', as: :json

      expect(json_response['roles'].pluck('name')).to include('Admin', 'Agent', 'Customer')
      expect(json_response['calendars'].pluck('name')).to include('Office hours')

      fields = json_response['attributes']
      expect(fields['ticket'].find { |field| field['name'] == 'customer_id' }).to include('data_type' => 'user_autocompletion', 'relation' => 'User')
      expect(fields['ticket'].find { |field| field['name'] == 'sh_campus' }['options'].pluck('value')).to eq(%w[LSST LSST::Wembley])
      expect(fields['user'].find { |field| field['name'] == 'vip' }).to include('data_type' => 'boolean')
      expect(fields['organization'].pluck('name')).to include('name', 'shared', 'domain', 'active')
    end

    it 'leaves out passwords and lists of ids' do
      get '/api/v1/studenthub/automation/options', as: :json

      expect(json_response['attributes']['user'].pluck('name')).not_to include('password', 'role_ids', 'group_ids', 'organization_ids')
      expect(json_response['attributes']['ticket'].pluck('name')).not_to include('tags')
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/automation/options', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'with someone who may only change macros' do
      let(:current_user) { create(:agent, roles: [create(:role, permission_names: ['admin.macro'])]) }

      it 'gives the choices too' do
        get '/api/v1/studenthub/automation/options', as: :json

        expect(response).to have_http_status(:ok)
      end
    end

    context 'with someone who may only change templates' do
      let(:current_user) { create(:agent, roles: [create(:role, permission_names: ['admin.template'])]) }

      it 'gives the choices too' do
        get '/api/v1/studenthub/automation/options', as: :json

        expect(response).to have_http_status(:ok)
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

    it 'saves a job with a fixed date, a list of titles and working time, and counts its tickets' do
      calendar = create(:calendar)
      condition = {
        'ticket.created_at'          => { operator: 'before (absolute)', value: '2026-09-01T00:00:00.000Z' },
        'ticket.title'               => { operator: 'starts with one of', value: %w[Laptop Password] },
        'customer.vip'               => { operator: 'is', value: true },
        'execution_time.calendar_id' => { operator: 'is not in working time', value: calendar.id.to_s },
      }
      travel_to(Time.zone.parse('2026-08-01')) { create(:ticket, title: 'Laptop broken', customer: create(:customer, vip: true)) }
      create(:ticket, title: 'Laptop too', customer: create(:customer, vip: true))

      post '/api/v1/jobs', params: payload.merge(condition:), as: :json
      expect(response).to have_http_status(:created)
      expect(Job.find(json_response['id']).condition['ticket.title']['value']).to eq(%w[Laptop Password])

      post '/api/v1/tickets/selector', params: { condition: condition.except('execution_time.calendar_id') }, as: :json
      expect(json_response['object_count']).to eq(1)
    end

    it 'counts the tickets a condition matches now' do
      travel_to(6.days.ago) { create_list(:ticket, 2, state: pending) }
      create(:ticket, state: pending)

      post '/api/v1/tickets/selector', params: { condition: payload[:condition] }, as: :json

      expect(json_response['object_count']).to eq(2)
    end
  end

  # Jobs on users and organisations: what the page sends for them.
  describe 'saving a job on users or organisations' do
    let(:timeplan) do
      { days: { Mon: true }, hours: { '3' => true }, minutes: { '0' => true } }
    end

    it 'switches off customers who have not signed in for a year and have no open tickets' do
      customer_role = Role.find_by(name: 'Customer')
      inactive = travel_to(2.years.ago) { create(:customer, last_login: Time.zone.now) }
      recent   = create(:customer, last_login: Time.zone.now)
      condition = {
        'user.role_ids'                 => { operator: 'is', value: [customer_role.id.to_s] },
        'user.last_login'               => { operator: 'before (relative)', value: '1', range: 'year' },
        'ticket_customer.open_existing' => { operator: 'is', value: false },
      }

      post '/api/v1/users/selector', params: { condition: }, as: :json
      expect(json_response['object_ids']).to include(inactive.id)
      expect(json_response['object_ids']).not_to include(recent.id)

      post '/api/v1/jobs', params: { name: 'Switch off old customers', object: 'User', active: true, timeplan:, condition:, perform: { 'user.active' => { value: 'false' } } }, as: :json
      expect(response).to have_http_status(:created)

      job = Job.find(json_response['id'])
      job.run(true)
      expect(inactive.reload.active).to be(false)
      expect(recent.reload.active).to be(true)
    end

    it 'adds a data privacy deletion task for matching users' do
      customer = create(:customer, note: 'leaver')
      post '/api/v1/jobs', params: {
        name: 'Remove leavers', object: 'User', active: true, timeplan:,
        condition: { 'user.note' => { operator: 'contains', value: 'leaver' } },
        perform: { 'user.action' => { value: 'data_privacy_deletion_task' } }
      }, as: :json
      expect(response).to have_http_status(:created)

      Job.find(json_response['id']).run(true)
      expect(DataPrivacyTask.where(deletable: customer)).to exist
    end

    it 'marks organisations without members as not shared' do
      empty = create(:organization, shared: true)
      post '/api/v1/jobs', params: {
        name: 'Unshare empty organisations', object: 'Organization', active: true, timeplan:,
        condition: { 'organization.members_existing' => { operator: 'is', value: false } },
        perform: { 'organization.shared' => { value: 'false' } }
      }, as: :json
      expect(response).to have_http_status(:created)

      Job.find(json_response['id']).run(true)
      expect(empty.reload.shared).to be(false)
    end
  end
end
