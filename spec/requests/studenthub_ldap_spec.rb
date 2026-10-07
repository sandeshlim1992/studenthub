# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub LDAP (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }

  describe 'GET /api/v1/studenthub/ldap' do
    it 'says whether LDAP is on and gives the roles and user fields to map to' do
      get '/api/v1/studenthub/ldap', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['enabled']).to be(false)
      expect(json_response['roles'].pluck('name')).to include('Agent', 'Customer')
      expect(json_response['user_attributes'].pluck('name')).to include('login', 'firstname', 'lastname', 'email')
      expect(json_response['user_attributes'].pluck('name')).not_to include('password')
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/ldap', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'PUT /api/v1/studenthub/ldap' do
    it 'switches the integration on and off' do
      put '/api/v1/studenthub/ldap', params: { enabled: true }, as: :json
      expect(Setting.get('ldap_integration')).to be(true)
      expect(json_response['enabled']).to be(true)

      put '/api/v1/studenthub/ldap', params: { enabled: false }, as: :json
      expect(Setting.get('ldap_integration')).to be(false)
    end
  end

  # The page saves LDAP servers through Zammad's API; this is what it sends.
  describe 'saving an LDAP server from the page' do
    let(:role) { Role.find_by(name: 'Agent') }
    let(:preferences) do
      {
        host:                 'dc.example.ac.uk',
        ssl:                  'ssl',
        ssl_verify:           true,
        base_dn:              'DC=example,DC=ac,DC=uk',
        bind_user:            'CN=zammad,OU=Service,DC=example,DC=ac,DC=uk',
        bind_pw:              'secret',
        user_uid:             'samaccountname',
        user_filter:          '(objectClass=user)',
        group_uid:            'dn',
        group_filter:         '(objectClass=group)',
        user_attributes:      { samaccountname: 'login', givenname: 'firstname', sn: 'lastname', mail: 'email' },
        group_role_map:       { 'CN=IT Staff,OU=Groups,DC=example,DC=ac,DC=uk' => [role.id.to_s] },
        group_role_recursive: { 'CN=IT Staff,OU=Groups,DC=example,DC=ac,DC=uk' => false },
        unassigned_users:     'sigup_roles',
      }
    end

    it 'stores the settings, hides the password and keeps it when the mask comes back' do
      post '/api/v1/ldap_sources', params: { name: 'College AD', active: true, preferences: preferences }, as: :json

      expect(response).to have_http_status(:created)
      source = LdapSource.find(json_response['id'])
      expect(source.preferences['user_attributes']).to include('samaccountname' => 'login')
      expect(source.preferences['group_role_map'].values.flatten).to eq([role.id.to_s])

      get "/api/v1/ldap_sources/#{source.id}", as: :json
      expect(json_response['preferences']['bind_pw']).to eq('**********')

      put "/api/v1/ldap_sources/#{source.id}", params: { name: 'College AD', active: false, preferences: json_response['preferences'] }, as: :json
      expect(response).to have_http_status(:ok)
      expect(source.reload.preferences['bind_pw']).to eq('secret')
      expect(source.active).to be(false)
    end
  end
end
