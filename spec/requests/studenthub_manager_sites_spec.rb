# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub manager sites', :aggregate_failures, type: :request do
  let(:site)    { create(:organization, name: 'FSB Spec Site') }
  let(:manager) { create_manager }
  let(:admin)   { create(:admin) }
  let(:agent)   { create(:agent) }

  describe 'GET /api/v1/studenthub/manager_sites' do
    it 'lists the managers with their sites, and the sites to choose from', authenticated_as: :admin do
      Studenthub::ManagerSites.assign!(manager, [site.id])

      get '/api/v1/studenthub/manager_sites', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['organizations'].pluck('name')).to include('FSB Spec Site')
      expect(json_response['managers']).to include(include('user_id' => manager.id, 'organization_ids' => [site.id]))
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/manager_sites', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'PUT /api/v1/studenthub/manager_sites/:user_id' do
    it "changes a manager's sites", authenticated_as: :admin do
      put "/api/v1/studenthub/manager_sites/#{manager.id}", params: { organization_ids: [site.id] }, as: :json

      expect(response).to have_http_status(:ok)
      expect(Studenthub::ManagerSites.organization_ids_for(manager)).to eq([site.id])
    end

    it 'refuses users who are not managers', authenticated_as: :admin do
      put "/api/v1/studenthub/manager_sites/#{agent.id}", params: { organization_ids: [site.id] }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'GET /api/v1/studenthub/manager_sites/stats' do
    it "shows the numbers of the manager's sites", authenticated_as: :manager do
      Studenthub::ManagerSites.assign!(manager, [site.id])
      customer = create(:customer, organization: site)
      create(:ticket, customer:, organization: site, state_name: 'open')
      create(:ticket, customer:, organization: site, state_name: 'closed', close_at: 2.days.ago)
      create(:ticket, customer:, organization: site, state_name: 'pending reminder', pending_time: 1.day.from_now)

      get '/api/v1/studenthub/manager_sites/stats', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['sites'].first).to include(
        'name'    => 'FSB Spec Site',
        'open'    => 2,
        'new'     => 3,
        'waiting' => 1,
        'closed'  => 1,
      )
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/manager_sites/stats', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
