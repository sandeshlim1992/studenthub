# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A student's answer to "Was this helpful?" under a Knowledge Base answer in the mobile app
# (Studenthub::MobileApp::KnowledgeBase), one per student and answer, which they may change. Staff
# see the counts on the answer in the new UI; who voted is not shown.
class StudenthubAnswerFeedback < ApplicationModel
  belongs_to :answer, class_name: 'KnowledgeBase::Answer'
  belongs_to :user

  validates :helpful, inclusion: { in: [true, false] }

  def self.vote!(answer:, user:, helpful:)
    find_or_initialize_by(answer:, user:).tap { |feedback| feedback.update!(helpful:) }
  end

  def self.counts(answer)
    votes = where(answer:).group(:helpful).count

    { helpful: votes.fetch(true, 0), not_helpful: votes.fetch(false, 0) }
  end
end
