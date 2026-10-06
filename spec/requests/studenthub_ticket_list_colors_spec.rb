# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub ticket list colour settings', aggregate_failures: true, type: :request do
  let(:colors)  { Setting.find_by(name: 'studenthub_ticket_state_colors') }
  let(:warning) { Setting.find_by(name: 'studenthub_escalation_warning_minutes') }

  context 'with an admin', authenticated_as: :admin do
    let(:admin) { create(:admin) }

    it 'can change the state colours' do
      put "/api/v1/settings/#{colors.id}", params: { state_current: { value: { '1' => 'teal', '2' => 'red' } } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_ticket_state_colors')).to eq({ '1' => 'teal', '2' => 'red' })
    end

    it 'gets an explanation for a colour outside the palette' do
      put "/api/v1/settings/#{colors.id}", params: { state_current: { value: { '1' => '#ff0000' } } }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include('not one of the available colours')
    end

    it 'can change the "due soon" point' do
      put "/api/v1/settings/#{warning.id}", params: { state_current: { value: 120 } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_escalation_warning_minutes')).to eq(120)
    end
  end

  context 'with an agent', authenticated_as: :agent do
    let(:agent) { create(:agent) }

    it 'reads both settings from the frontend config but cannot change them' do
      get '/api/v1/signshow'
      expect(json_response.dig('config', 'studenthub_escalation_warning_minutes')).to eq(60)
      expect(json_response.dig('config', 'studenthub_ticket_state_colors')).to be_a(Hash)

      put "/api/v1/settings/#{warning.id}", params: { state_current: { value: 15 } }, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(Setting.get('studenthub_escalation_warning_minutes')).to eq(60)
    end
  end
end
