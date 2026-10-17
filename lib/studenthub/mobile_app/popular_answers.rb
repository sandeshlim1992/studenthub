# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Knowledge Base answers admins choose for the mobile app's Home. Only answers
# published in the help center count, which anyone may read there: internal answers and drafts
# are never offered or shown, and a chosen answer that stops being published drops off Home.
# Each opens in the mobile app's Knowledge Base (Studenthub::MobileApp::KnowledgeBase).
module Studenthub::MobileApp::PopularAnswers
  # The answers admins can choose from (Administration → Manage → Mobile app), by category.
  def self.choices
    published_answers.map do |answer|
      { id: answer.id, title: answer.translation_primary&.title || answer.translation.title, category: category_title(answer) }
    end
  end

  # The chosen answers that are still published, in the admins' order, with the title in the
  # user's language where the answer has one.
  def self.for(user)
    ids     = Array(Setting.get(Studenthub::MobileApp::POPULAR_ANSWERS))
    answers = published_answers.where(id: ids).index_by(&:id)
    return [] if answers.empty?

    kb_locale = Studenthub::MobileApp::KnowledgeBase.kb_locale(user)

    ids.filter_map { |id| answers[id] }.map do |answer|
      { id: answer.id, title: answer.translation_preferred(kb_locale).title }
    end
  end

  def self.published_answers
    Studenthub::MobileApp::KnowledgeBase.published_answers.includes(:category, translations: { kb_locale: :system_locale })
  end

  def self.category_title(answer)
    answer.category.translation_primary&.title || answer.category.translation.title
  end

  private_class_method :published_answers, :category_title
end
