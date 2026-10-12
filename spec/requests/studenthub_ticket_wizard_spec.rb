# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub ticket wizard', :aggregate_failures, authenticated_as: :current_user, type: :request do
  let(:current_user) { create(:customer) }

  before do
    create(:object_manager_attribute_select, name: 'category2', data_option_options: { 'Service Request' => 'Service Request', 'Software' => 'Software Support' })
    create(:object_manager_attribute_select, name: 'subcategory', data_option_options: { 'Password Reset' => 'Password Reset', 'Outlook' => 'Outlook', 'Others' => 'Others' })
    create(:object_manager_attribute_select, name: 'campus', data_option_options: { 'LSST Wembley' => 'LSST Wembley' })
    # Others is under both categories, each of the rest under one
    create(:core_workflow, object:             'Ticket',
                           condition_selected: { 'ticket.category2' => { 'operator' => 'is', 'value' => ['Service Request'] } },
                           perform:            { 'ticket.subcategory' => { 'operator' => 'remove_option', 'remove_option' => ['Outlook'] } })
    create(:core_workflow, object:             'Ticket',
                           condition_selected: { 'ticket.category2' => { 'operator' => 'is', 'value' => ['Software'] } },
                           perform:            { 'ticket.subcategory' => { 'operator' => 'remove_option', 'remove_option' => ['Password Reset'] } })
  end

  describe 'GET /api/v1/studenthub/ticket_wizard_metadata' do
    it 'gives the categories, the sub-categories under each and the campuses' do
      get '/api/v1/studenthub/ticket_wizard_metadata', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['categories']).to eq([{ 'name' => 'Service Request', 'value' => 'Service Request' }, { 'name' => 'Software Support', 'value' => 'Software' }])
      expect(json_response['all_subcategories'].pluck('value')).to eq(['Password Reset', 'Outlook', 'Others'])
      expect(json_response['subcategories_by_category'].transform_values { |list| list.pluck('value') })
        .to eq('Service Request' => ['Password Reset', 'Others'], 'Software' => %w[Outlook Others])
      expect(json_response['campuses']).to eq([{ 'name' => 'LSST Wembley', 'value' => 'LSST Wembley' }])
    end

    context 'with an agent' do
      let(:current_user) { create(:agent) }

      it 'answers' do
        get '/api/v1/studenthub/ticket_wizard_metadata', as: :json

        expect(response).to have_http_status(:ok)
      end
    end

    context 'when signed out' do
      let(:current_user) { nil }

      it 'refuses' do
        get '/api/v1/studenthub/ticket_wizard_metadata', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
