# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub SLA preview', aggregate_failures: true, type: :request do
  let(:high) { Ticket::Priority.find_by(name: '3 high') }

  before do
    Sla.destroy_all
    create(:sla, name: 'SLA: High', solution_time: 180, condition: { 'ticket.priority_id' => { operator: 'is', value: [high.id.to_s] } })
  end

  it 'returns the SLA a new ticket would get', authenticated_as: -> { create(:agent) } do
    get '/api/v1/studenthub/sla_preview', params: { priority_id: high.id }

    expect(response).to have_http_status(:ok)
    expect(json_response).to include('status' => 'match')
    expect(json_response['sla']).to include('name' => 'SLA: High', 'solution_time' => 180)
  end

  it 'is not for customers', authenticated_as: -> { create(:customer) } do
    get '/api/v1/studenthub/sla_preview', params: { priority_id: high.id }

    expect(response).to have_http_status(:forbidden)
  end
end
