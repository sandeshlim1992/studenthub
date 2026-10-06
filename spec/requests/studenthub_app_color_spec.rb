# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub application colour setting', aggregate_failures: true, type: :request do
  let(:setting) { Setting.find_by(name: 'studenthub_app_color') }

  it 'is part of the public frontend config, so the sign-in page can use it', authenticated_as: false do
    get '/api/v1/signshow'

    expect(json_response.dig('config', 'studenthub_app_color')).to eq('#14234b')
  end

  context 'with an admin', authenticated_as: :admin do
    let(:admin) { create(:admin) }

    it 'can change it' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: '#296374' } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_app_color')).to eq('#296374')
    end

    it 'gets an explanation for a colour that is too light' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: '#ffca08' } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include('too light')
      expect(Setting.get('studenthub_app_color')).to eq('#14234b')
    end
  end

  context 'with an agent', authenticated_as: :agent do
    let(:agent) { create(:agent) }

    it 'cannot change it' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: '#296374' } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Setting.get('studenthub_app_color')).to eq('#14234b')
    end
  end
end
