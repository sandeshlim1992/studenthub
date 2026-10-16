# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub mobile app quick links', aggregate_failures: true, type: :request do
  let(:setting) { Setting.find_by(name: 'studenthub_mobile_quick_links') }
  let(:links)   { [{ 'label' => 'Moodle', 'url' => 'https://moodle.example.ac.uk' }] }

  def save(value)
    put "/api/v1/settings/#{setting.id}", params: { state_current: { value: } }, as: :json
  end

  context 'with an admin', authenticated_as: :admin do
    let(:admin) { create(:admin) }

    it 'can save quick links' do
      save(links)

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_mobile_quick_links')).to eq(links)
    end

    it 'gets an explanation for an address that is not a web address' do
      save([{ 'label' => 'Moodle', 'url' => 'javascript:alert(1)' }])

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).to include('must be a full address')
      expect(Setting.get('studenthub_mobile_quick_links')).to eq([])
    end
  end

  context 'with staff who may only change the mobile app', authenticated_as: :mobile_admin do
    let(:mobile_admin) { create(:agent, roles: [create(:role, permission_names: ['admin.mobile_app'])]) }

    it 'can save quick links' do
      save(links)

      expect(response).to have_http_status(:ok)
      expect(Setting.get('studenthub_mobile_quick_links')).to eq(links)
    end
  end

  context 'with an agent', authenticated_as: :agent do
    let(:agent) { create(:agent) }

    it 'cannot save quick links' do
      save(links)

      expect(response).to have_http_status(:forbidden)
      expect(Setting.get('studenthub_mobile_quick_links')).to eq([])
    end
  end

  describe 'who gets them' do
    before { Setting.set('studenthub_mobile_quick_links', links) }

    context 'with a student', authenticated_as: :customer do
      let(:customer) { create(:customer) }

      it 'sends them with the app config' do
        get '/api/v1/signshow'

        expect(json_response.dig('config', 'studenthub_mobile_quick_links')).to eq(links)
      end
    end

    it 'leaves them out before signing in', authenticated_as: false do
      get '/api/v1/signshow'

      expect(json_response['config']).not_to have_key('studenthub_mobile_quick_links')
    end
  end
end
