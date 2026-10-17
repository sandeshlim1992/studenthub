# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub mobile app popular answers', aggregate_failures: true, type: :request do
  let(:category) { create(:knowledge_base_category, knowledge_base: create(:knowledge_base)) }
  let!(:wifi)    { create(:knowledge_base_answer, :published, category:, translation_attributes: { title: 'Connect to the Wi-Fi' }) }
  let!(:secret)  { create(:knowledge_base_answer, :internal, category:, translation_attributes: { title: 'Staff only: VPN keys' }) }
  let(:agent)    { create(:agent) }
  let(:customer) { create(:customer) }

  describe 'GET /api/v1/studenthub/mobile_app/answer_choices' do
    context 'with staff who may change the mobile app', authenticated_as: :mobile_admin do
      let(:mobile_admin) { create(:agent, roles: [create(:role, permission_names: ['admin.mobile_app'])]) }

      it 'lists only the published answers' do
        get '/api/v1/studenthub/mobile_app/answer_choices', as: :json

        expect(response).to have_http_status(:ok)
        expect(json_response.pluck('title')).to eq(['Connect to the Wi-Fi'])
      end
    end

    it 'refuses agents', authenticated_as: :agent do
      get '/api/v1/studenthub/mobile_app/answer_choices', as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it 'refuses students', authenticated_as: :customer do
      get '/api/v1/studenthub/mobile_app/answer_choices', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'GET /api/v1/studenthub/mobile_app/popular_answers' do
    before { Setting.set('studenthub_mobile_popular_answers', [wifi.id]) }

    it 'gives students the chosen answers', authenticated_as: :customer do
      get '/api/v1/studenthub/mobile_app/popular_answers', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response).to eq([{ 'id' => wifi.id, 'title' => 'Connect to the Wi-Fi', 'url' => "/help/#{wifi.translation.kb_locale.system_locale.locale}/#{category.translation.to_param}/#{wifi.translation.to_param}" }])
    end

    it 'gives nothing before signing in', authenticated_as: false do
      get '/api/v1/studenthub/mobile_app/popular_answers', as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe 'choosing them', authenticated_as: :admin do
    let(:admin)   { create(:admin) }
    let(:setting) { Setting.find_by(name: 'studenthub_mobile_popular_answers') }

    it 'saves published answers and refuses internal ones' do
      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: [wifi.id] } }, as: :json
      expect(response).to have_http_status(:ok)

      put "/api/v1/settings/#{setting.id}", params: { state_current: { value: [secret.id] } }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      expect(Setting.get('studenthub_mobile_popular_answers')).to eq([wifi.id])
    end
  end
end
