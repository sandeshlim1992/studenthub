# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub Members', :aggregate_failures, type: :request do
  let(:agent) { create(:agent) }

  describe 'GET /api/v1/studenthub/members' do
    it 'lists the members for agents', authenticated_as: :agent do
      get '/api/v1/studenthub/members', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['online_window_minutes']).to eq(5)
      expect(json_response['members'].pluck('id')).to include(agent.id)
    end

    context 'with an admin', authenticated_as: :admin do
      let(:admin) { create(:admin) }

      it 'lists the members' do
        get '/api/v1/studenthub/members', as: :json

        expect(response).to have_http_status(:ok)
      end
    end

    context 'with a manager without another staff role', authenticated_as: :manager do
      let(:manager) { create_manager }

      it 'refuses' do
        get '/api/v1/studenthub/members', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'with a customer', authenticated_as: :customer do
      let(:customer) { create(:customer) }

      it 'refuses' do
        get '/api/v1/studenthub/members', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
