# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub ticket views', aggregate_failures: true, type: :request do
  let(:group) { create(:group) }
  let!(:team_view) do
    group
    Studenthub::TicketViews::Teams.sync!
    Overview.find_by(link: Studenthub::TicketViews::Teams.link(group))
  end

  context 'with an agent of the group', authenticated_as: :agent do
    let(:agent) { create(:agent, groups: [group]) }

    it 'returns the team overview' do
      get '/api/v1/studenthub/ticket_views'

      expect(response).to have_http_status(:ok)
      expect(json_response['teams']).to include({ 'overview_id' => team_view.id, 'group_id' => group.id })
    end
  end

  context 'with a customer', authenticated_as: :customer do
    let(:customer) { create(:customer) }

    it 'is not available' do
      get '/api/v1/studenthub/ticket_views'

      expect(response).to have_http_status(:forbidden)
    end
  end
end
