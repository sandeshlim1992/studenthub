# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub mobile app Knowledge Base', aggregate_failures: true, type: :request do
  let(:category)  { create(:knowledge_base_category, knowledge_base: create(:knowledge_base)) }
  let(:hidden)    { create(:knowledge_base_category, knowledge_base: category.knowledge_base) }
  let!(:wifi)     { create(:knowledge_base_answer, :published, category:, translation_attributes: { title: 'Connect to the Wi-Fi' }) }
  let!(:secret)   { create(:knowledge_base_answer, :internal, category: hidden, translation_attributes: { title: 'Staff only: VPN keys' }) }
  let(:customer)  { create(:customer) }
  let(:agent)     { create(:agent) }
  let(:admin)     { create(:admin) }

  describe 'GET /api/v1/studenthub/mobile_app/knowledge_base' do
    it 'lists the topics with published answers', authenticated_as: :customer do
      get '/api/v1/studenthub/mobile_app/knowledge_base', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['topics'].pluck('id')).to eq([category.id])
    end

    it 'gives nothing before signing in', authenticated_as: false do
      get '/api/v1/studenthub/mobile_app/knowledge_base', as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it 'is not found while the Knowledge Base is off', authenticated_as: :customer do
      category.knowledge_base.update!(active: false)
      get '/api/v1/studenthub/mobile_app/knowledge_base', as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/studenthub/mobile_app/knowledge_base/categories/:id' do
    it "gives a topic's answers", authenticated_as: :customer do
      get "/api/v1/studenthub/mobile_app/knowledge_base/categories/#{category.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['answers']).to eq([{ 'id' => wifi.id, 'title' => 'Connect to the Wi-Fi' }])
    end

    it 'refuses a topic without published answers', authenticated_as: :customer do
      get "/api/v1/studenthub/mobile_app/knowledge_base/categories/#{hidden.id}", as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it 'does not show staff who edit the Knowledge Base a topic without published answers', authenticated_as: :admin do
      get "/api/v1/studenthub/mobile_app/knowledge_base/categories/#{hidden.id}", as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/studenthub/mobile_app/knowledge_base/answers/:id' do
    it 'gives a published answer', authenticated_as: :customer do
      get "/api/v1/studenthub/mobile_app/knowledge_base/answers/#{wifi.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response).to include('title' => 'Connect to the Wi-Fi', 'helpful' => nil)
    end

    it 'gives agents published answers too', authenticated_as: :agent do
      get "/api/v1/studenthub/mobile_app/knowledge_base/answers/#{wifi.id}", as: :json

      expect(response).to have_http_status(:ok)
    end

    it 'does not find an internal answer, not even for staff who edit the Knowledge Base', authenticated_as: :admin do
      get "/api/v1/studenthub/mobile_app/knowledge_base/answers/#{secret.id}", as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe 'GET /api/v1/studenthub/mobile_app/knowledge_base/search' do
    it 'finds published answers', authenticated_as: :customer do
      get '/api/v1/studenthub/mobile_app/knowledge_base/search', params: { query: 'Wi-Fi' }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response.pluck('id')).to eq([wifi.id])
    end
  end

  describe 'PUT /api/v1/studenthub/mobile_app/knowledge_base/answers/:id/feedback' do
    let(:path) { "/api/v1/studenthub/mobile_app/knowledge_base/answers/#{wifi.id}/feedback" }

    it 'saves and changes the vote of a student', authenticated_as: :customer do
      put path, params: { helpful: true }, as: :json
      expect(response).to have_http_status(:ok)
      expect(json_response).to eq({ 'helpful' => true })

      put path, params: { helpful: false }, as: :json
      expect(StudenthubAnswerFeedback.where(answer: wifi, user: customer).pluck(:helpful)).to eq([false])
    end

    it 'refuses anything but yes or no', authenticated_as: :customer do
      put path, params: { helpful: 'yes' }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
      expect(StudenthubAnswerFeedback.count).to eq(0)
    end

    it 'does not take votes on an internal answer', authenticated_as: :customer do
      put "/api/v1/studenthub/mobile_app/knowledge_base/answers/#{secret.id}/feedback", params: { helpful: true }, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it 'takes votes only from students', authenticated_as: :agent do
      put path, params: { helpful: true }, as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it 'shows staff the counts on the answer in the new UI', authenticated_as: :admin do
      StudenthubAnswerFeedback.vote!(answer: wifi, user: customer, helpful: true)
      get "/api/v1/studenthub/knowledge_base/answers/#{wifi.id}", as: :json

      expect(json_response['feedback']).to eq({ 'helpful' => 1, 'not_helpful' => 0 })
    end
  end
end
