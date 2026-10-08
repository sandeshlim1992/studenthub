# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub S/MIME, PGP and Exchange (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }
  let(:group)        { create(:group, name: 'Spec Team') }

  describe 'S/MIME and PGP settings' do
    %w[smime pgp].each do |kind|
      context "with #{kind}" do
        it 'switches it on, signs system notifications and sets per-team defaults, keeping other config' do
          Setting.set("#{kind}_config", { 'group_id' => { 'default_sign' => { '999' => true } }, 'other' => 'kept' })

          put "/api/v1/studenthub/integrations/#{kind}", params: {
            enabled: true, sign_system_notifications: true, groups: [{ id: group.id, sign: true, encryption: false }],
          }, as: :json

          expect(response).to have_http_status(:ok)
          expect(Setting.get("#{kind}_integration")).to be(true)
          expect(Setting.get("#{kind}_sign_system_notifications")).to be(true)
          config = Setting.get("#{kind}_config")
          expect(config['group_id']['default_sign']).to include(group.id.to_s => true, '999' => true)
          expect(config['group_id']['default_encryption']).to include(group.id.to_s => false)
          expect(config['other']).to eq('kept')
          expect(json_response['groups'].find { |row| row['id'] == group.id }).to include('sign' => true, 'encryption' => false)
        end
      end
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/integrations/smime', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # The pages add certificates and keys through Zammad's API; this is what they send.
  describe 'certificates and keys from the pages' do
    it 'adds an S/MIME certificate and its private key, then removes them' do
      base = Rails.root.join('spec/fixtures/files/smime/smime1@example.com')

      post '/api/v1/integration/smime/certificate', params: { certificate: File.read("#{base}.crt") }, as: :json
      expect(response).to have_http_status(:ok)
      certificate = SMIMECertificate.last
      expect(certificate.email_addresses).to include('smime1@example.com')

      post '/api/v1/integration/smime/private_key', params: { private_key: File.read("#{base}.key"), secret: File.read("#{base}.secret").strip }, as: :json
      expect(response).to have_http_status(:ok)
      expect(certificate.reload.private_key).to be_present

      delete '/api/v1/integration/smime/certificate', params: { id: certificate.id }, as: :json
      expect(SMIMECertificate).not_to exist(certificate.id)
    end

    it 'adds a PGP key and deletes it' do
      base = Rails.root.join('spec/fixtures/files/pgp/multipgp2@example.com')

      post '/api/v1/integration/pgp/key', params: { private_key: File.read("#{base}.pub.asc") }, as: :json
      expect(response).to have_http_status(:created)
      key = PGPKey.find(json_response['id'])
      expect(key.email_addresses).to include('multipgp2@example.com')

      delete "/api/v1/integration/pgp/key/#{key.id}", as: :json
      expect(PGPKey).not_to exist(key.id)
    end
  end

  describe 'Exchange settings' do
    it 'never sends the password and keeps it when the mask comes back' do
      Setting.set('exchange_config', { 'auth_type' => 'basic', 'endpoint' => 'https://mail.example.ac.uk/EWS/Exchange.asmx', 'user' => 'zammad@example.ac.uk', 'password' => 'secret', 'folders' => ['AAMk1'], 'attributes' => { 'given_name' => 'firstname' } })

      get '/api/v1/studenthub/integrations/exchange', as: :json
      expect(json_response['config']).to include('password' => '**********', 'user' => 'zammad@example.ac.uk', 'folders' => ['AAMk1'])
      expect(json_response.to_json).not_to include('secret')
      expect(json_response['user_attributes'].pluck('name')).to include('firstname', 'email')

      put '/api/v1/studenthub/integrations/exchange', params: {
        enabled: true,
        config:  json_response['config'].merge('folders' => %w[AAMk1 AAMk2], 'attributes' => { 'given_name' => 'firstname', 'surname' => 'lastname' }),
      }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Setting.get('exchange_integration')).to be(true)
      expect(Setting.get('exchange_config')).to include('password' => 'secret', 'folders' => %w[AAMk1 AAMk2], 'attributes' => { 'given_name' => 'firstname', 'surname' => 'lastname' })
    end

    it 'says which Microsoft 365 app and account are connected, without secrets' do
      create(:external_credential, name: 'exchange', credentials: { 'client_id' => 'abc', 'client_secret' => 'top-secret', 'client_tenant' => 'tenant-1' })
      Setting.set('exchange_oauth', { 'access_token' => 'token-xyz', 'user' => 'it@example.ac.uk', 'created_at' => Time.zone.now })

      get '/api/v1/studenthub/integrations/exchange', as: :json

      expect(json_response['app']).to include('client_id' => 'abc', 'client_tenant' => 'tenant-1')
      expect(json_response['account']).to include('user' => 'it@example.ac.uk')
      expect(json_response.to_json).not_to include('top-secret', 'token-xyz')
    end

    it 'uses the stored password when the page sends the mask back' do
      Setting.set('exchange_config', { 'password' => 'secret' })
      allow(Sequencer).to receive(:process).and_return({ folders: { 'AAMk1' => 'Contacts' } })

      post '/api/v1/integration/exchange/folders', params: { auth_type: 'basic', endpoint: 'https://mail.example.ac.uk/EWS/Exchange.asmx', user: 'zammad@example.ac.uk', password: '**********' }, as: :json

      expect(json_response).to include('result' => 'ok', 'folders' => { 'AAMk1' => 'Contacts' })
      expect(Sequencer).to have_received(:process).with('Import::Exchange::AvailableFolders', parameters: { ews_config: hash_including(password: 'secret') })
    end

    it 'sends the admin back to the new UI after the Microsoft sign-in' do
      classic = Class.new { def self.link_account(*) = 'https://helpdesk.example/#system/integration/exchange/success/1' }
      classic.singleton_class.prepend(Studenthub::ExchangeReturn)

      expect(classic.link_account('token', {})).to eq('https://helpdesk.example/desktop/manage/system/integrations/exchange?result=success%2F1')
      expect(ExternalCredential::Exchange.singleton_class.ancestors).to include(Studenthub::ExchangeReturn)
    end
  end
end
