# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub Roles (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }
  let(:group)        { create(:group, name: 'Spec Team') }

  describe 'GET /api/v1/studenthub/roles' do
    it 'gives the roles with their permissions, team access and active users, and what can be given' do
      role = create(:role, name: 'Spec Agents', permission_names: %w[ticket.agent report], group_ids_access_map: { group.id => %w[read change] })
      create_list(:agent, 2, roles: [role])
      create(:agent, roles: [role], active: false)

      get '/api/v1/studenthub/roles', as: :json

      expect(response).to have_http_status(:ok)
      row = json_response['roles'].find { |item| item['name'] == 'Spec Agents' }
      expect(row).to include('user_count' => 2, 'active' => true)
      expect(row['group_ids']).to eq(group.id.to_s => %w[read change])
      expect(row['permission_ids']).to match_array(Permission.where(name: %w[ticket.agent report]).ids)

      agent_tickets = json_response['permissions'].find { |item| item['name'] == 'ticket.agent' }
      expect(agent_tickets).to include('label' => 'Agent tickets', 'groups' => true, 'disabled' => false)
      expect(json_response['permissions'].find { |item| item['name'] == 'ticket' }).to include('disabled' => true)
      expect(json_response['permissions'].find { |item| item['name'] == 'user_preferences.out_of_office' }).to include('required' => ['ticket.agent'])
      expect(json_response['groups'].pluck('name')).to include('Spec Team')
      expect(json_response['my_role_ids']).to match_array(current_user.role_ids)
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/roles', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # The Roles page saves through Zammad's roles API; this is what it sends.
  describe 'saving a role from the page' do
    let(:permission_ids) { Permission.where(name: %w[ticket.agent knowledge_base.reader user_preferences]).ids }

    it 'creates a role with permissions and team access, then changes it' do
      post '/api/v1/roles', params: {
        name: 'Spec Night Desk', note: 'Evenings', active: true, default_at_signup: false,
        permission_ids: permission_ids, group_ids: { group.id.to_s => ['full'] },
      }, as: :json

      expect(response).to have_http_status(:created)
      role = Role.find(json_response['id'])
      expect(role.permissions.map(&:name)).to contain_exactly('ticket.agent', 'knowledge_base.reader', 'user_preferences')
      expect(role.group_ids_access_map).to eq(group.id => ['full'])

      put "/api/v1/roles/#{role.id}", params: {
        name: 'Spec Night Desk', note: 'Evenings', active: false, default_at_signup: false,
        permission_ids: permission_ids, group_ids: { group.id.to_s => %w[read overview] },
      }, as: :json

      expect(response).to have_http_status(:ok)
      expect(role.reload.active).to be(false)
      expect(role.saved_group_ids_access_map).to eq(group.id => %w[read overview])
    end
  end
end
