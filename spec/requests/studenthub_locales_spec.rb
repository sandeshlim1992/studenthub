# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub locales', :aggregate_failures, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:admin) }

  describe 'GET /api/v1/studenthub/locales' do
    it 'lists the active languages with their ids' do
      Locale.find_by(locale: 'de-de').update!(active: false)

      get '/api/v1/studenthub/locales', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response).to include({ 'id' => Locale.find_by(locale: 'en-us').id, 'locale' => 'en-us', 'alias' => 'en', 'name' => 'English (United States)', 'dir' => 'ltr', 'active' => true })
      expect(json_response.pluck('locale')).not_to include('de-de')
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'refuses' do
        get '/api/v1/studenthub/locales', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
