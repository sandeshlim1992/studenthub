# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub checklist assignments', :aggregate_failures, type: :request do
  let(:admin)    { create(:admin) }
  let(:agent)    { create(:agent) }
  let(:template) { create(:checklist_template, name: 'Onboarding', items: [], created_by_id: 1, updated_by_id: 1) }
  let(:id_card)  { create(:checklist_template, name: 'ID card', items: [], created_by_id: 1, updated_by_id: 1) }

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'People' => 'People' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Onboarding' => 'Onboarding', 'ID card' => 'ID card' })
  end

  def assign(checklist, *sub_categories)
    put "/api/v1/studenthub/checklist_assignments/#{checklist.id}",
        params: { sub_categories: sub_categories.map { |sub_category| { category: 'People', sub_category: } } }, as: :json
  end

  it 'sets and lists the sub-categories a checklist is added for', authenticated_as: :admin do
    assign(template, 'Onboarding')

    expect(response).to have_http_status(:ok)
    expect(json_response['assignments']).to contain_exactly(include('category' => 'People', 'sub_category' => 'Onboarding', 'checklist_template_id' => template.id, 'missing' => false))

    get '/api/v1/studenthub/checklist_assignments', as: :json

    expect(json_response['assignments'].pluck('sub_category')).to eq(['Onboarding'])
    expect(json_response['categories']).to eq([{ 'value' => 'People', 'label' => 'People' }])
    expect(json_response['sub_categories']['People'].pluck('value')).to eq(['Onboarding', 'ID card'])
  end

  it 'says when another checklist gets that sub-category already', authenticated_as: :admin do
    assign(template, 'Onboarding')
    assign(id_card, 'Onboarding')

    expect(response).to have_http_status(:unprocessable_content)
    expect(json_response['error_human']).to eq('People › Onboarding already gets the checklist "Onboarding".')
  end

  it 'refuses agents', authenticated_as: :agent do
    get '/api/v1/studenthub/checklist_assignments', as: :json
    expect(response).to have_http_status(:forbidden)

    assign(template, 'Onboarding')
    expect(response).to have_http_status(:forbidden)
  end
end
