# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Studenthub::MobileApp::PopularAnswers, aggregate_failures: true do
  let(:knowledge_base) { create(:knowledge_base) }
  let(:category)       { create(:knowledge_base_category, knowledge_base:) }
  let(:student)        { create(:customer) }

  let!(:wifi)     { create(:knowledge_base_answer, :published, category:, translation_attributes: { title: 'Connect to the Wi-Fi' }) }
  let!(:password) { create(:knowledge_base_answer, :published, category:, translation_attributes: { title: 'Reset your password' }) }

  # Answers students may never see.
  before do
    create(:knowledge_base_answer, :internal, category:, translation_attributes: { title: 'Staff only: VPN keys' })
    create(:knowledge_base_answer, :draft, category:, translation_attributes: { title: 'Draft answer' })
    create(:knowledge_base_answer, :archived, category:, translation_attributes: { title: 'Old answer' })
  end

  def choose(*answers)
    Setting.set('studenthub_mobile_popular_answers', answers.map(&:id))
  end

  describe '.choices' do
    it 'offers only the answers published in the help center, with their category' do
      choices = described_class.choices

      expect(choices.pluck(:id)).to contain_exactly(wifi.id, password.id)
      expect(choices).to include({ id: wifi.id, title: 'Connect to the Wi-Fi', category: category.translation.title })
      expect(choices.pluck(:title)).not_to include('Staff only: VPN keys', 'Draft answer', 'Old answer')
    end

    it 'offers nothing while the Knowledge Base is off' do
      knowledge_base.update!(active: false)

      expect(described_class.choices).to be_empty
    end
  end

  describe '.for' do
    it "gives the chosen answers in the admins' order with their help center page" do
      choose(password, wifi)

      expect(described_class.for(student)).to eq(
        [
          { id: password.id, title: 'Reset your password', url: "/help/#{password.translation.kb_locale.system_locale.locale}/#{category.translation.to_param}/#{password.translation.to_param}" },
          { id: wifi.id, title: 'Connect to the Wi-Fi', url: "/help/#{wifi.translation.kb_locale.system_locale.locale}/#{category.translation.to_param}/#{wifi.translation.to_param}" },
        ]
      )
    end

    it 'leaves out a chosen answer that is no longer published' do
      choose(password, wifi)
      password.update!(published_at: nil, internal_at: 1.day.ago)

      expect(described_class.for(student).pluck(:id)).to eq([wifi.id])
    end

    it 'gives nothing when no answers are chosen' do
      expect(described_class.for(student)).to eq([])
    end
  end
end
