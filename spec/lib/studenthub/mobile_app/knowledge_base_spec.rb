# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::MobileApp::KnowledgeBase, aggregate_failures: true do
  let(:knowledge_base) { create(:knowledge_base) }
  let(:student)        { create(:customer) }

  let(:it_accounts) { create(:knowledge_base_category, knowledge_base:, category_icon: 'f108') }
  let(:wifi_topic)  { create(:knowledge_base_category, knowledge_base:, parent: it_accounts) }
  let(:staff_topic) { create(:knowledge_base_category, knowledge_base:) }

  let!(:password) { create(:knowledge_base_answer, :published, category: it_accounts, translation_attributes: { title: 'Reset your password' }) }
  let!(:wifi)     { create(:knowledge_base_answer, :published, category: wifi_topic, translation_attributes: { title: 'Connect to the Wi-Fi' }) }

  # Answers students may never see.
  before do
    create(:knowledge_base_answer, :internal, category: it_accounts, translation_attributes: { title: 'Staff only: VPN keys' })
    create(:knowledge_base_answer, :draft, category: it_accounts, translation_attributes: { title: 'Draft answer' })
    create(:knowledge_base_answer, :archived, category: wifi_topic, translation_attributes: { title: 'Old answer' })
    create(:knowledge_base_answer, :internal, category: staff_topic, translation_attributes: { title: 'Staff handbook' })
  end

  def title_of(category)
    category.translation.title
  end

  describe '.topic' do
    it 'lists the top topics with published answers, counting their sub-topics' do
      expect(described_class.topic(student)).to eq(
        {
          topic:   nil,
          topics:  [{ id: it_accounts.id, title: title_of(it_accounts), icon: 'f108', answer_count: 2 }],
          answers: [],
        }
      )
    end

    it "gives a topic's sub-topics and its own published answers, with the topics above it" do
      topic = described_class.topic(student, it_accounts)

      expect(topic[:topic]).to eq({ id: it_accounts.id, title: title_of(it_accounts), path: [] })
      expect(topic[:topics]).to eq([{ id: wifi_topic.id, title: title_of(wifi_topic), icon: wifi_topic.category_icon, answer_count: 1 }])
      expect(topic[:answers]).to eq([{ id: password.id, title: 'Reset your password' }])

      expect(described_class.topic(student, wifi_topic)[:topic][:path]).to eq([{ id: it_accounts.id, title: title_of(it_accounts) }])
    end

    it 'gives nothing for a topic without published answers' do
      expect(described_class.topic(student, staff_topic)).to be_nil
    end

    it 'gives nothing while the Knowledge Base is off' do
      knowledge_base.update!(active: false)

      expect(described_class.topic(student)).to be_nil
      expect(described_class.published_answers).to be_empty
    end
  end

  describe '.answer' do
    it 'gives its text, topics, files and the vote of the student' do
      StudenthubAnswerFeedback.vote!(answer: wifi, user: student, helpful: false)

      expect(described_class.answer(student, wifi)).to include(
        id:          wifi.id,
        title:       'Connect to the Wi-Fi',
        body:        wifi.translation.content.body,
        path:        [{ id: it_accounts.id, title: title_of(it_accounts) }, { id: wifi_topic.id, title: title_of(wifi_topic) }],
        attachments: [],
        helpful:     false,
      )
      expect(described_class.answer(create(:customer), wifi)[:helpful]).to be_nil
    end

    it "gives the text in the student's language where the answer has one" do
      german = create(:knowledge_base_locale, knowledge_base:, system_locale: Locale.find_by(locale: 'de-de'))
      create(:knowledge_base_answer_translation, answer: wifi, kb_locale: german, title: 'Mit dem WLAN verbinden')
      student.update!(preferences: { locale: 'de-de' })

      expect(described_class.answer(student, wifi)[:title]).to eq('Mit dem WLAN verbinden')
      expect(described_class.answer(create(:customer), wifi)[:title]).to eq('Connect to the Wi-Fi')
    end

    it 'opens links to other answers in the app' do
      wifi.translation.content.update!(body: %(<p>First <a href="/help/x" data-target-type="knowledge-base-answer" data-target-id="#{password.translation.id}">reset it</a>.</p>))

      expect(described_class.answer(student, wifi)[:body]).to include(%(href="/mobile/knowledge-base/answers/#{password.id}"))
    end

    it 'plays videos as the help center does' do
      video = create(:knowledge_base_answer, :published, :with_video, category: it_accounts)

      expect(described_class.answer(student, video)[:body]).to include('<iframe', 'youtube')
    end
  end

  describe '.search' do
    it 'finds only published answers, with their topic' do
      results = described_class.search(student, 'password')

      expect(results.map { |result| result.except(:snippet) }).to eq([{ id: password.id, title: 'Reset your password', topic: title_of(it_accounts) }])
      expect(results.first[:snippet]).to be_present
      expect(described_class.search(student, 'VPN')).to be_empty
    end

    it 'puts answers named after the words before those that only mention them' do
      mail = create(:knowledge_base_answer, :published, category: it_accounts, translation_attributes: { title: 'Email on your phone' })
      mail.translation.content.update!(body: 'Sign in with your college password.')

      expect(described_class.search(student, 'password').pluck(:id)).to eq([password.id, mail.id])
    end

    it 'leaves out drafts and internal answers for staff who edit the Knowledge Base too' do
      expect(described_class.search(create(:admin), 'answer')).to be_empty
    end

    it 'finds nothing without words' do
      expect(described_class.search(student, '  ')).to eq([])
    end
  end
end
