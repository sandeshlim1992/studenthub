# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub sign-in page texts setting', aggregate_failures: true, type: :request do
  let(:setting)  { Setting.find_by(name: 'studenthub_login_panel') }
  let(:defaults) { Studenthub::Theme::LoginPanelSetup::DEFAULTS }
  let(:texts)    { { 'heading' => 'IT Service Desk', 'tagline' => 'Help in one place.', 'description' => '' } }

  it 'is part of the public frontend config, so the sign-in page can use it', authenticated_as: false do
    get '/api/v1/signshow'

    expect(json_response.dig('config', 'studenthub_login_panel')).to eq(defaults)
  end

  context 'with an admin', authenticated_as: :admin do
    let(:admin) { create(:admin) }

    it 'can change them' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: texts } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_login_panel')).to eq(texts)
    end

    it 'gets an explanation for a text that is too long' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: texts.merge('heading' => 'x' * 61) } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include('at most 60 characters')
      expect(Setting.get('studenthub_login_panel')).to eq(defaults)
    end
  end

  context 'with an agent', authenticated_as: :agent do
    let(:agent) { create(:agent) }

    it 'cannot change them' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: texts } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Setting.get('studenthub_login_panel')).to eq(defaults)
    end
  end
end
