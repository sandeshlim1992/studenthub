# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

require 'rails_helper'

RSpec.describe StudenthubAnswerFeedback, aggregate_failures: true, type: :model do
  let(:answer)  { create(:knowledge_base_answer, :published) }
  let(:student) { create(:customer) }

  describe '.vote!' do
    it 'keeps one vote per student and answer, which they may change' do
      described_class.vote!(answer:, user: student, helpful: true)
      described_class.vote!(answer:, user: student, helpful: false)

      expect(described_class.where(answer:, user: student).pluck(:helpful)).to eq([false])
    end

    it 'refuses a vote that is neither yes nor no' do
      expect { described_class.vote!(answer:, user: student, helpful: nil) }.to raise_error(ActiveRecord::RecordInvalid)
    end
  end

  describe '.counts' do
    it 'counts the yes and no votes on the answer' do
      described_class.vote!(answer:, user: student, helpful: true)
      described_class.vote!(answer:, user: create(:customer), helpful: true)
      described_class.vote!(answer:, user: create(:customer), helpful: false)
      described_class.vote!(answer: create(:knowledge_base_answer, :published), user: student, helpful: false)

      expect(described_class.counts(answer)).to eq({ helpful: 2, not_helpful: 1 })
    end

    it 'counts nothing before anyone votes' do
      expect(described_class.counts(answer)).to eq({ helpful: 0, not_helpful: 0 })
    end
  end

  it 'keeps one vote per answer when two students are merged' do
    other   = create(:knowledge_base_answer, :published)
    primary = create(:customer)
    described_class.vote!(answer:, user: primary, helpful: true)
    described_class.vote!(answer:, user: student, helpful: false)
    described_class.vote!(answer: other, user: student, helpful: true)

    primary.merge(student.id)

    expect(described_class.where(user: primary).pluck(:answer_id, :helpful)).to contain_exactly([answer.id, true], [other.id, true])
    expect(described_class.where(user: student)).to be_empty
  end

  it 'goes with the answer and with the student' do
    described_class.vote!(answer:, user: student, helpful: true)
    described_class.vote!(answer: create(:knowledge_base_answer, :published), user: student, helpful: true)

    answer.destroy!
    expect(described_class.where(user: student).count).to eq(1)

    student.destroy!
    expect(described_class.count).to eq(0)
  end
end
