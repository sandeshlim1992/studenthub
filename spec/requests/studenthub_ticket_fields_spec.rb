# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub ticket states, priorities and tags (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }

  describe 'ticket states' do
    it 'lists the states with their type and tickets, and the types' do
      open_state = Ticket::State.find_by(name: 'open')
      create_list(:ticket, 2, state: open_state)

      get '/api/v1/studenthub/ticket_states', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['states'].find { |state| state['name'] == 'open' }).to include('state_type' => 'open', 'ticket_count' => 2)
      expect(json_response['state_types'].pluck('name')).to include('new', 'open', 'pending reminder', 'pending action', 'closed')
    end

    it 'adds, changes and deletes a state through Zammad' do
      pending_action = Ticket::StateType.find_by(name: 'pending action')
      closed = Ticket::State.find_by(name: 'closed')

      post '/api/v1/ticket_states', params: {
        name: 'Waiting for parts', state_type_id: pending_action.id, next_state_id: closed.id,
        ignore_escalation: true, default_create: false, default_follow_up: false, active: true, note: 'Hardware',
      }, as: :json
      expect(response).to have_http_status(:created)
      state = Ticket::State.find(json_response['id'])
      expect(state).to have_attributes(next_state_id: closed.id, ignore_escalation: true)

      put "/api/v1/ticket_states/#{state.id}", params: { name: 'Waiting for hardware', state_type_id: pending_action.id, next_state_id: closed.id, active: false }, as: :json
      expect(state.reload).to have_attributes(name: 'Waiting for hardware', active: false)

      delete "/api/v1/ticket_states/#{state.id}", as: :json
      expect(Ticket::State).not_to exist(state.id)
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/ticket_states', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'ticket priorities' do
    it 'lists the priorities with their tickets, and saves one through Zammad' do
      high = Ticket::Priority.find_by(name: '3 high')
      create(:ticket, priority: high)

      get '/api/v1/studenthub/ticket_priorities', as: :json
      expect(json_response['priorities'].find { |priority| priority['id'] == high.id }).to include('ticket_count' => 1, 'ui_color' => 'high-priority')

      post '/api/v1/ticket_priorities', params: { name: 'P0 - Major incident', ui_color: 'high-priority', default_create: false, active: true }, as: :json
      expect(response).to have_http_status(:created)
      priority = Ticket::Priority.find(json_response['id'])

      put "/api/v1/ticket_priorities/#{priority.id}", params: { name: 'P0 - Major incident', ui_color: nil, active: true }, as: :json
      expect(priority.reload.ui_color).to be_nil

      delete "/api/v1/ticket_priorities/#{priority.id}", as: :json
      expect(Ticket::Priority).not_to exist(priority.id)
    end
  end

  describe 'tags' do
    it 'switches whether users may create new tags' do
      put '/api/v1/studenthub/tag_settings', params: { tag_new: false }, as: :json
      expect(Setting.get('tag_new')).to be(false)
      expect(json_response).to eq('tag_new' => false)

      put '/api/v1/studenthub/tag_settings', params: { tag_new: true }, as: :json
      expect(Setting.get('tag_new')).to be(true)
    end

    it 'adds, renames (merging into an existing tag) and deletes tags through Zammad' do
      ticket = create(:ticket)
      ticket.tag_add('wifi', 1)
      ticket.tag_add('eduroam', 1)

      post '/api/v1/tag_list', params: { name: 'printing' }, as: :json
      expect(Tag::Item.find_by(name: 'printing')).to be_present

      put "/api/v1/tag_list/#{Tag::Item.find_by(name: 'eduroam').id}", params: { id: Tag::Item.find_by(name: 'eduroam').id, name: 'wifi' }, as: :json
      expect(ticket.reload.tag_list).to eq(['wifi'])

      delete "/api/v1/tag_list/#{Tag::Item.find_by(name: 'printing').id}", as: :json
      expect(Tag::Item.find_by(name: 'printing')).to be_nil
    end
  end
end
