# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub new UI at /', :aggregate_failures, type: :request do
  it 'serves the new UI at the home address' do
    get '/'

    expect(response).to have_http_status(:ok)
    expect(controller).to be_a(DesktopController)
  end

  it 'serves the new UI at its own pages' do
    get '/tickets/1'

    expect(response).to have_http_status(:ok)
    expect(controller).to be_a(DesktopController)
  end

  it 'opens the new UI for an unknown page address, which says the page does not exist' do
    get '/not_existing_url'

    expect(response).to have_http_status(:ok)
    expect(controller).to be_a(DesktopController)
  end

  it 'keeps the classic UI at /app' do
    get '/app'

    expect(response).to have_http_status(:ok)
    expect(controller).to be_a(InitController)
  end

  it 'sends old /desktop links to the same page without /desktop' do
    get '/desktop/tickets/1?article=2'

    expect(response).to redirect_to('/tickets/1?article=2')
    expect(response).to have_http_status(:found)
  end

  it 'sends /desktop itself to the home address' do
    get '/desktop'

    expect(response).to redirect_to('/')
  end

  it 'leaves unknown server addresses a 404' do
    get '/api/v1/no_such_thing', as: :json

    expect(response).to have_http_status(:not_found)
  end

  it 'does not open the new UI for unknown addresses under a server path' do
    get '/assets/no-such-file.png'

    expect(controller).not_to be_a(DesktopController)
  end

  describe Studenthub::NewUiAtRoot do
    it 'keeps sign-in returns on this server' do
      expect(described_class.local_path('/tickets/1')).to eq('/tickets/1')
      expect(described_class.local_path('')).to eq('/')
      expect(described_class.local_path('//evil.example')).to eq('/')
      expect(described_class.local_path('/\\evil.example')).to eq('/')
      expect(described_class.local_path('https://evil.example')).to eq('/')
    end

    it 'knows a sign-in started from the classic UI' do
      expect(described_class.classic_origin?('https://helpdesk.example/app')).to be(true)
      expect(described_class.classic_origin?('https://helpdesk.example/login?redirect=/approvals')).to be(false)
      expect(described_class.classic_origin?(nil)).to be(false)
    end
  end
end
