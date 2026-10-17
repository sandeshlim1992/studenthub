# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Knowledge Base answers admins choose for the mobile app's Home. Only answers
# published in the help center count, which anyone may read there: internal answers and drafts
# are never offered or shown, and a chosen answer that stops being published drops off Home.
module Studenthub::MobileApp::PopularAnswers
  # The answers admins can choose from (Administration → Manage → Mobile app), by category.
  def self.choices
    published_answers.map do |answer|
      { id: answer.id, title: answer.translation_primary&.title || answer.translation.title, category: category_title(answer) }
    end
  end

  # The chosen answers that are still published, in the admins' order: the title in the user's
  # language where the answer has one, and its page in the help center.
  def self.for(user)
    ids     = Array(Setting.get(Studenthub::MobileApp::POPULAR_ANSWERS))
    answers = published_answers.where(id: ids).index_by(&:id)
    return [] if answers.empty?

    kb_locale = preferred_kb_locale(user)

    ids.filter_map { |id| answers[id] }.map do |answer|
      translation = answer.translation_preferred(kb_locale)
      { id: answer.id, title: translation.title, url: help_path(answer, translation) }
    end
  end

  def self.published_answers
    knowledge_base = KnowledgeBase.first
    return KnowledgeBase::Answer.none if !knowledge_base&.active?

    KnowledgeBase::Answer.published
      .where(category: knowledge_base.categories)
      .includes(:category, translations: { kb_locale: :system_locale })
  end

  def self.category_title(answer)
    answer.category.translation_primary&.title || answer.category.translation.title
  end

  def self.preferred_kb_locale(user)
    locale = user.preferences['locale'].presence || Locale.default
    KnowledgeBase.first.kb_locales.joins(:system_locale).find_by(locales: { locale: }) || KnowledgeBase.first.kb_locales.find_by(primary: true)
  end

  def self.help_path(answer, translation)
    Rails.application.routes.url_helpers.help_answer_path(
      answer.category.translation_preferred(translation.kb_locale),
      translation,
      locale: translation.kb_locale.system_locale.locale
    )
  end

  private_class_method :published_answers, :category_title, :preferred_kb_locale, :help_path
end
