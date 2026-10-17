# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe Setting::Validation::StudenthubMobilePopularAnswers, aggregate_failures: true do
  let(:setting_name) { 'studenthub_mobile_popular_answers' }
  let(:category)     { create(:knowledge_base_category, knowledge_base: create(:knowledge_base)) }
  let(:published)    { create_list(:knowledge_base_answer, 6, :published, category:) }
  let(:internal)     { create(:knowledge_base_answer, :internal, category:) }

  it 'accepts up to 5 published answers, in any order' do
    ids = published.first(5).map(&:id).reverse

    expect { Setting.set(setting_name, ids) }.not_to raise_error
    expect(Setting.get(setting_name)).to eq(ids)
    expect { Setting.set(setting_name, []) }.not_to raise_error
  end

  it 'refuses internal answers, too many, twice the same and anything but answer IDs' do
    {
      [internal.id]                 => %r{Only answers published in the help center},
      [published.first.id, 999_999] => %r{Only answers published in the help center},
      published.map(&:id)           => %r{at most 5 popular answers},
      [published.first.id] * 2      => %r{only once},
      [published.first.id.to_s]     => %r{must be a list of answers},
      published.first.id            => %r{must be a list of answers},
    }.each do |value, message|
      expect { Setting.set(setting_name, value) }.to raise_error(ActiveRecord::RecordInvalid, message)
    end
    expect(Setting.get(setting_name)).to eq([])
  end
end
