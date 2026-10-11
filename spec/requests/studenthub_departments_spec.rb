# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub departments', :aggregate_failures, type: :request do
  let(:admin)  { create(:admin) }
  let(:agent)  { create(:agent) }
  let(:params) { { name: 'Registry', email: 'registry@studenthub.example', locations: ['LSST Wembley'] } }

  before do
    create(:object_manager_attribute_select, name: 'campus', data_option_options: { 'LSST Wembley' => 'LSST Wembley', 'FSB Sheffield' => 'FSB Sheffield' })
  end

  def create_department(**attributes)
    UserInfo.ensure_current_user_id { StudenthubDepartment.create!(params.merge(attributes)) }
  end

  describe 'GET /api/v1/studenthub/departments' do
    it 'lists the departments and the campuses to choose from', authenticated_as: :admin do
      create_department

      get '/api/v1/studenthub/departments', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['enabled']).to be(false)
      expect(json_response['departments']).to contain_exactly(
        include('name' => 'Registry', 'email' => 'registry@studenthub.example', 'locations' => ['LSST Wembley'], 'missing_locations' => [])
      )
      expect(json_response['campuses']).to eq([{ 'value' => 'LSST Wembley', 'label' => 'LSST Wembley' }, { 'value' => 'FSB Sheffield', 'label' => 'FSB Sheffield' }])
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/departments', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'POST /api/v1/studenthub/departments' do
    it 'creates a department', authenticated_as: :admin do
      post '/api/v1/studenthub/departments', params:, as: :json

      expect(response).to have_http_status(:created)
      expect(StudenthubDepartment.find(json_response['id'])).to have_attributes(name: 'Registry', locations: ['LSST Wembley'])
    end

    it 'says what is wrong', authenticated_as: :admin do
      post '/api/v1/studenthub/departments', params: params.merge(email: 'nope'), as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error_human']).to eq('nope is not a valid email address.')
    end
  end

  describe 'PUT /api/v1/studenthub/departments/settings' do
    it 'switches departments on and off', authenticated_as: :admin do
      put '/api/v1/studenthub/departments/settings', params: { enabled: true }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response).to eq('enabled' => true)
      expect(Studenthub::Departments).to be_enabled

      put '/api/v1/studenthub/departments/settings', params: { enabled: false }, as: :json

      expect(json_response).to eq('enabled' => false)
      expect(Studenthub::Departments).not_to be_enabled
    end

    it 'refuses agents', authenticated_as: :agent do
      put '/api/v1/studenthub/departments/settings', params: { enabled: true }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Studenthub::Departments).not_to be_enabled
    end
  end

  describe 'PUT and DELETE /api/v1/studenthub/departments/:id' do
    it 'changes a department', authenticated_as: :admin do
      department = create_department

      put "/api/v1/studenthub/departments/#{department.id}", params: params.merge(locations: ['FSB Sheffield']), as: :json

      expect(response).to have_http_status(:ok)
      expect(department.reload.locations).to eq(['FSB Sheffield'])
    end

    it 'deletes a department', authenticated_as: :admin do
      department = create_department

      delete "/api/v1/studenthub/departments/#{department.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(StudenthubDepartment).not_to exist(department.id)
    end
  end
end
