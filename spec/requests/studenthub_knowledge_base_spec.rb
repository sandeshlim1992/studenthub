# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe 'Student Hub Knowledge Base (new UI)', aggregate_failures: true, authenticated_as: :current_user, type: :request do
  include_context 'basic Knowledge Base'

  let(:editor)       { create(:admin) }
  let(:reader)       { create(:agent) }
  let(:current_user) { editor }

  let(:answer_ids) { json_response['answers'].pluck('id') }

  describe 'GET /api/v1/studenthub/knowledge_base' do
    before do
      draft_answer
      internal_answer
      published_answer
      archived_answer
    end

    it 'gives editors every category and answer, with states and titles per language' do
      get '/api/v1/studenthub/knowledge_base', as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response['knowledge_base']).to include('id' => knowledge_base.id, 'can_create_category' => true)
      expect(json_response['knowledge_base']['locales']).to include(include('id' => primary_locale.id, 'primary' => true))
      expect(json_response['categories']).to include(include('id' => category.id, 'editable' => true))
      expect(answer_ids).to contain_exactly(draft_answer.id, internal_answer.id, published_answer.id, archived_answer.id)

      row = json_response['answers'].find { |answer| answer['id'] == internal_answer.id }
      expect(row).to include('state' => 'internal', 'category_id' => category.id, 'editable' => true)
      expect(row['titles']).to eq(primary_locale.id.to_s => internal_answer.translations.first.title)
    end

    context 'with a reader' do
      let(:current_user) { reader }

      it 'gives readers only internal and public answers, nothing editable' do
        get '/api/v1/studenthub/knowledge_base', as: :json

        expect(answer_ids).to contain_exactly(internal_answer.id, published_answer.id)
        expect(json_response['knowledge_base']['can_create_category']).to be(false)
        expect(json_response['answers'].pluck('editable')).to all(be(false))
      end
    end

    context 'with a student' do
      let(:current_user) { create(:customer) }

      it 'refuses' do
        get '/api/v1/studenthub/knowledge_base', as: :json

        expect(response).to have_http_status(:forbidden)
      end
    end

    context 'without a Knowledge Base' do
      it 'says there is none' do
        allow(KnowledgeBase).to receive(:first).and_return(nil)
        get '/api/v1/studenthub/knowledge_base', as: :json

        expect(json_response).to eq('knowledge_base' => nil, 'categories' => [], 'answers' => [])
      end
    end
  end

  describe 'GET /api/v1/studenthub/knowledge_base/answers/:id' do
    it 'gives the text, attachments and whether it can be edited' do
      get "/api/v1/studenthub/knowledge_base/answers/#{published_answer.id}", as: :json

      translation = published_answer.translations.first
      expect(json_response).to include('id' => published_answer.id, 'state' => 'published', 'editable' => true, 'knowledge_base_id' => knowledge_base.id)
      expect(json_response['translations']).to contain_exactly(include('id' => translation.id, 'title' => translation.title, 'body' => translation.content.body_with_urls))
      expect(json_response['attachments']).to contain_exactly(include('filename' => published_answer.attachments.first.filename))
    end

    it 'gives inline images as attachment addresses, keeping their cid' do
      get "/api/v1/studenthub/knowledge_base/answers/#{published_answer_with_image.id}", as: :json

      body = json_response['translations'].first['body']
      expect(body).to match(%r{<img[^>]+src="/api/v1/attachments/\d+"})
      expect(body).to match(%r{<img[^>]+cid="[^"]+"})
      expect(body).not_to include('src="cid:')
    end

    context 'with a reader' do
      let(:current_user) { reader }

      it 'shows internal answers read-only and hides drafts' do
        get "/api/v1/studenthub/knowledge_base/answers/#{internal_answer.id}", as: :json
        expect(json_response).to include('id' => internal_answer.id, 'editable' => false)

        get "/api/v1/studenthub/knowledge_base/answers/#{draft_answer.id}", as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  describe 'GET /api/v1/studenthub/knowledge_base/search' do
    let(:findable) { 'eduroam' }

    before do
      [draft_answer, internal_answer, published_answer].each do |answer|
        answer.translations.first.update!(title: "Connect to #{findable} (#{Service::StudenthubKnowledgeBase::Tree.state(answer)})")
      end
      create(:knowledge_base_answer, :published, category: category, translation_attributes: { title: 'Printing on campus' })
    end

    it 'finds answers by their text, newest change first, with their state and category' do
      get '/api/v1/studenthub/knowledge_base/search', params: { query: findable }, as: :json

      expect(response).to have_http_status(:ok)
      expect(json_response.pluck('id')).to contain_exactly(draft_answer.id, internal_answer.id, published_answer.id)
      expect(json_response.find { |row| row['id'] == internal_answer.id }).to include('state' => 'internal', 'category_id' => category.id)
      expect(json_response.first).to include('title', 'snippet', 'kb_locale_id', 'updated_at')
    end

    it 'gives the start of the text as plain words' do
      published_answer.translations.first.content.update!(body: '<p>Open&nbsp;<b>Settings</b> &amp; choose Wi-Fi</p>')
      get '/api/v1/studenthub/knowledge_base/search', params: { query: findable }, as: :json

      expect(json_response.find { |row| row['id'] == published_answer.id }['snippet']).to eq('Open Settings & choose Wi-Fi')
    end

    it 'gives nothing for an empty search' do
      get '/api/v1/studenthub/knowledge_base/search', params: { query: ' ' }, as: :json

      expect(json_response).to eq([])
    end

    context 'with a reader' do
      let(:current_user) { reader }

      it 'leaves out drafts' do
        get '/api/v1/studenthub/knowledge_base/search', params: { query: findable }, as: :json

        expect(json_response.pluck('id')).to contain_exactly(internal_answer.id, published_answer.id)
      end
    end
  end

  # The page saves through Zammad's Knowledge Base API; these are the requests it sends.
  describe 'saving from the page' do
    let(:base) { "/api/v1/knowledge_bases/#{knowledge_base.id}" }

    # A fresh copy: reload keeps the publishing state the answer worked out before.
    def state_of(answer)
      Service::StudenthubKnowledgeBase::Tree.state(KnowledgeBase::Answer.find(answer.id))
    end

    it 'creates, edits, publishes, archives and deletes an answer' do
      post "#{base}/answers", params: {
        category_id:             category.id,
        translations_attributes: [{ kb_locale_id: primary_locale.id, title: 'Reset your password', content_attributes: { body: '<p>Go to <b>Settings</b>.</p>' } }],
      }, as: :json
      expect(response).to have_http_status(:created)
      answer = KnowledgeBase::Answer.find(json_response['id'])
      expect(answer.translations.first.content.body).to include('<b>Settings</b>')

      get "/api/v1/studenthub/knowledge_base/answers/#{answer.id}", as: :json
      translation = json_response['translations'].first
      patch "#{base}/answers/#{answer.id}", params: {
        category_id:             other_category.id,
        translations_attributes: [{ id: translation['id'], kb_locale_id: primary_locale.id, title: 'Reset a password', content_attributes: { body: '<p>Changed</p>' } }],
      }, as: :json
      expect(response).to have_http_status(:ok)
      expect(answer.reload.category).to eq(other_category)
      expect(answer.translations.first).to have_attributes(title: 'Reset a password')
      expect(answer.translations.first.content.body).to eq('<p>Changed</p>')

      # Zammad keeps publishing times to the minute, and each step must come after the previous one.
      post "#{base}/answers/#{answer.id}/internal", as: :json
      travel 1.minute
      expect(state_of(answer)).to eq('internal')
      post "#{base}/answers/#{answer.id}/publish", as: :json
      travel 1.minute
      expect(state_of(answer)).to eq('published')
      post "#{base}/answers/#{answer.id}/archive", as: :json
      travel 1.minute
      expect(state_of(answer)).to eq('archived')
      post "#{base}/answers/#{answer.id}/unarchive", as: :json
      travel 1.minute
      expect(state_of(answer)).to eq('published')

      delete "#{base}/answers/#{answer.id}", as: :json
      expect(KnowledgeBase::Answer).not_to exist(answer.id)
    end

    it 'keeps inline images that come back with their cid, and stores new embedded ones' do
      answer      = published_answer_with_image
      translation = answer.translations.first
      get "/api/v1/studenthub/knowledge_base/answers/#{answer.id}", as: :json
      body = json_response['translations'].first['body']
      kept = translation.content.attachments.first
      png  = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      patch "#{base}/answers/#{answer.id}", params: {
        category_id:             answer.category_id,
        translations_attributes: [{ id: translation.id, kb_locale_id: primary_locale.id, title: translation.title, content_attributes: { body: "#{body}<p><img src=\"#{png}\"></p>" } }],
      }, as: :json

      expect(response).to have_http_status(:ok)
      content = translation.reload.content
      expect(content.attachments.map(&:id)).to include(kept.id)
      expect(content.attachments.size).to eq(2)
      expect(content.body.scan('src="cid:').size).to eq(2)
    end

    it 'creates, renames and deletes a category' do
      post "#{base}/categories", params: {
        knowledge_base_id: knowledge_base.id, parent_id: category.id, category_icon: 'f115',
        translations_attributes: [{ kb_locale_id: primary_locale.id, title: 'Wi-Fi' }],
      }, as: :json
      expect(response).to have_http_status(:created)
      created = KnowledgeBase::Category.find(json_response['id'])
      expect(created).to have_attributes(parent: category, category_icon: 'f115')

      patch "#{base}/categories/#{created.id}", params: {
        category_icon: 'f0eb', translations_attributes: [{ id: created.translations.first.id, kb_locale_id: primary_locale.id, title: 'Wireless' }],
      }, as: :json
      expect(created.reload.translations.first.title).to eq('Wireless')

      delete "#{base}/categories/#{created.id}", as: :json
      expect(KnowledgeBase::Category).not_to exist(created.id)
    end

    it 'adds and removes an attachment' do
      answer = draft_answer
      post "#{base}/answers/#{answer.id}/attachments", params: { file: fixture_file_upload('upload/hello_world.txt', 'text/plain') }
      expect(response).to have_http_status(:ok)
      expect(answer.reload.attachments.map(&:filename)).to eq(['hello_world.txt'])

      delete "#{base}/answers/#{answer.id}/attachments/#{answer.attachments.first.id}", as: :json
      expect(answer.reload.attachments).to be_empty
    end

    context 'with a reader' do
      let(:current_user) { reader }

      it 'refuses changes' do
        patch "#{base}/answers/#{internal_answer.id}", params: { category_id: other_category.id }, as: :json

        expect(response).to have_http_status(:forbidden)
        expect(internal_answer.reload.category).to eq(category)
      end
    end
  end
end
