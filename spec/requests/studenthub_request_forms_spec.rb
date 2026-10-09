# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub request forms', :aggregate_failures, type: :request do
  let(:admin)    { create(:admin) }
  let(:agent)    { create(:agent) }
  let(:hr)       { create(:organization, name: 'HR spec') }
  let(:hr_staff) { create(:customer, organization: hr) }
  let(:student)  { create(:customer) }
  let(:draft) do
    {
      category:         'People',
      sub_category:     'Onboarding',
      title:            'Staff onboarding',
      help_text:        'Tell us about the new starter.',
      fields:           [{ name: 'start_date', required: true }],
      organization_ids: [],
      role_ids:         [],
    }
  end

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People', 'IT' => 'IT' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding', 'Wi-Fi' => 'Wi-Fi' })
    create(:object_manager_attribute_date, name: 'start_date', display: 'Start date')
  end

  def create_form(definition = draft, publish: false)
    UserInfo.ensure_current_user_id do
      form = StudenthubRequestForm.create!(draft: StudenthubRequestForm.normalize_definition(definition))
      form.publish! if publish
      form
    end
  end

  describe 'GET /api/v1/studenthub/request_forms' do
    it 'lists the forms and what admins can choose from', authenticated_as: :admin do
      create_form

      get '/api/v1/studenthub/request_forms', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['forms'].first).to include('status' => 'draft', 'problems' => [])
      expect(json_response['options']['categories'].pluck('value')).to eq(%w[People IT])
      expect(json_response['options']['sub_categories']['People'].pluck('value')).to eq(%w[Onboarding Wi-Fi])
      expect(json_response['options']['fields'].find { |field| field['name'] == 'start_date' }).to include('shown_for' => [])
      expect(json_response['options']['fields'].pluck('name')).not_to include('category2', 'subcategory')
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/request_forms', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'POST /api/v1/studenthub/request_forms' do
    it 'saves a draft', authenticated_as: :admin do
      post '/api/v1/studenthub/request_forms', params: { draft: }, as: :json

      expect(response).to have_http_status(:created)
      expect(json_response).to include('status' => 'draft', 'published' => nil)
      expect(json_response['draft']['fields']).to eq([{ 'name' => 'start_date', 'required' => true }])
    end

    it 'refuses a second form for the same sub-category', authenticated_as: :admin do
      create_form

      post '/api/v1/studenthub/request_forms', params: { draft: }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(json_response['error_human']).to eq('People › Onboarding already has a request form.')
    end

    it 'refuses the fields a form is chosen by', authenticated_as: :admin do
      post '/api/v1/studenthub/request_forms', params: { draft: draft.merge(fields: [{ name: 'category2' }]) }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe 'publishing' do
    it 'publishes the draft and puts the field in customers\' and agents\' forms', authenticated_as: :admin do
      form = create_form

      post "/api/v1/studenthub/request_forms/#{form.id}/publish", as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['status']).to eq('published')
      screens = ObjectManager::Attribute.get(object: 'Ticket', name: 'start_date').screens
      expect(screens['create_middle']['ticket.customer']).to include('shown' => false)
      expect(screens['edit']['ticket.agent']).to include('shown' => true)
    end

    it 'refuses a form without fields', authenticated_as: :admin do
      form = create_form(draft.merge(fields: []))

      post "/api/v1/studenthub/request_forms/#{form.id}/publish", as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(form.reload.published).to be_nil
    end

    it 'keeps later changes in the draft until they are published or discarded', authenticated_as: :admin do
      form = create_form(publish: true)

      put "/api/v1/studenthub/request_forms/#{form.id}", params: { draft: draft.merge(title: 'New starters') }, as: :json
      expect(json_response['status']).to eq('changed')
      expect(json_response['published']['title']).to eq('Staff onboarding')

      post "/api/v1/studenthub/request_forms/#{form.id}/discard", as: :json
      expect(json_response['status']).to eq('published')
      expect(json_response['draft']['title']).to eq('Staff onboarding')

      post "/api/v1/studenthub/request_forms/#{form.id}/unpublish", as: :json
      expect(json_response['status']).to eq('draft')
    end

    it 'flags a published form whose sub-category was removed', authenticated_as: :admin do
      create_form(publish: true)
      ObjectManager::Attribute.get(object: 'Ticket', name: 'subcategory').tap do |attribute|
        attribute.update_columns(data_option: attribute.data_option.merge('options' => { 'Wi-Fi' => 'Wi-Fi' }))
      end

      get '/api/v1/studenthub/request_forms', as: :json

      expect(json_response['forms'].first['published_problems']).to eq(['This sub-category no longer exists.'])
    end
  end

  describe 'GET /api/v1/studenthub/request_forms/applicable' do
    before { create_form(draft.merge(organization_ids: [hr.id]), publish: true) }

    it 'gives the form to customers it is meant for', authenticated_as: :hr_staff do
      get '/api/v1/studenthub/request_forms/applicable', params: { category: 'People', sub_category: 'Onboarding' }

      expect(response).to have_http_status(:ok)
      expect(json_response).to include('title' => 'Staff onboarding', 'fields' => [{ 'name' => 'start_date', 'required' => true }])
    end

    it 'gives nothing to other customers', authenticated_as: :student do
      get '/api/v1/studenthub/request_forms/applicable', params: { category: 'People', sub_category: 'Onboarding' }

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq('null')
    end
  end
end
