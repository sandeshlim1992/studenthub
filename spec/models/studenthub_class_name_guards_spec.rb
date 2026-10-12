# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

# Student Hub: names from requests that Zammad turns into classes only reach the classes meant for them.
RSpec.describe 'Student Hub class name guards', :aggregate_failures do # rubocop:disable RSpec/DescribeClass
  describe Sessions::Event do
    def run_event(event)
      described_class.run(event:, payload: {}, session: {}, remote_ip: '127.0.0.1', client_id: '123', clients: {}, options: {})
    end

    it 'runs session events but not other classes in their namespace' do
      expect(run_event('base').dig(:data, :error)).to include('is not a session event')
      expect(run_event('ping').to_s).not_to include('is not a session event')
    end
  end

  describe ExternalCredential do
    it 'loads the providers but not their base classes or helpers' do
      expect(described_class.load_backend('google')).to eq(ExternalCredential::Google)
      expect(described_class.load_backend('microsoft_graph')).to eq(ExternalCredential::MicrosoftGraph)
      expect { described_class.load_backend('base/channel_xoauth2') }.to raise_error(NameError, %r{not an external credential provider})
      expect { described_class.load_backend('sensitive_attributes') }.to raise_error(NameError, %r{not an external credential provider})
    end
  end

  describe Authorization do
    it 'refuses a name that is not a sign-in provider' do
      expect { described_class.create_from_hash({ 'provider' => 'account_error', 'uid' => '1', 'info' => {} }) }
        .to raise_error(NameError, %r{not a sign-in provider})
    end
  end

  describe RecentView do
    let(:agent)  { create(:agent, groups: [ticket.group]) }
    let(:ticket) { create(:ticket) }

    it 'checks access for Zammad models only' do
      expect(described_class.access('Ticket', ticket.id, agent)).to be(true)
      expect(described_class.access('Logger', 1, agent)).to be_nil
      expect(described_class.access('Kernel', 1, agent)).to be_nil
    end
  end

  describe 'SMS channels', authenticated_as: :admin, type: :request do
    let(:admin) { create(:admin) }

    it 'tests only with Zammad’s SMS drivers' do
      post '/api/v1/channels_sms/test', params: { options: { adapter: 'sms/base' }, recipient: '+441234567890', message: 'Test' }, as: :json

      expect(json_response['error_human']).to eq("The parameter 'options.adapter' has the invalid value 'sms/base'!")

      allow(Channel::Driver::Sms::Twilio).to receive(:new).and_return(instance_double(Channel::Driver::Sms::Twilio, deliver: true))
      post '/api/v1/channels_sms/test', params: { options: { adapter: 'sms/twilio' }, recipient: '+441234567890', message: 'Test' }, as: :json

      expect(json_response).to eq('success' => true)
    end

    it 'saves only channels with Zammad’s SMS drivers' do
      post '/api/v1/channels_sms', params: { area: 'Sms::Notification', options: { adapter: 'sms/base' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(Channel.where(area: 'Sms::Notification').count).to eq(0)
    end
  end
end
