# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub ticket view choice', aggregate_failures: true, type: :request do
  let(:agent)    { create(:agent) }
  let(:overview) { create(:overview, roles: [Role.find_by(name: 'Agent')], group_by: 'owner') }
  let(:url)      { "/api/v1/studenthub/ticket_views/#{overview.id}/choice" }

  describe 'an agent', authenticated_as: :agent do
    it "shows, changes and resets the agent's grouping and order" do
      get url
      expect(json_response).to include('group_by' => 'owner', 'default_group_by' => 'owner', 'customised' => false)
      expect(json_response['grouping_options']).to include({ 'value' => 'owner', 'label' => 'Agent' }, { 'value' => 'state', 'label' => 'State' })

      put url, params: { group_by: 'priority' }, as: :json
      expect(json_response).to include('group_by' => 'priority', 'customised' => true)

      # The new UI sends GraphQL's direction names.
      put url, params: { order_by: 'number', order_direction: 'ASCENDING' }, as: :json
      expect(json_response).to include('group_by' => 'priority', 'order_by' => 'number', 'order_direction' => 'ASC')

      delete url, as: :json
      expect(json_response).to include('group_by' => 'owner', 'customised' => false)
    end

    it 'refuses an unknown grouping' do
      put url, params: { group_by: 'password' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it 'is only for views the agent has' do
      other = create(:overview, roles: [Role.find_by(name: 'Admin')])

      get "/api/v1/studenthub/ticket_views/#{other.id}/choice"

      expect(response).to have_http_status(:forbidden)
    end
  end

  it 'is not for customers', authenticated_as: -> { create(:customer) } do
    get url

    expect(response).to have_http_status(:forbidden)
  end
end
