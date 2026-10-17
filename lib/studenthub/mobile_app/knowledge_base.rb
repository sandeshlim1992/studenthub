# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Knowledge Base in the mobile app (design 1 "Topics", .dev/DECISIONS.md). Only what
# the help center publishes, which anyone may read there: topics with published answers in them or
# their sub-topics, and those answers, in the user's language where they have one. Drafts, internal
# and archived answers never show, nor anything while the Knowledge Base is off.
module Studenthub::MobileApp::KnowledgeBase
  SEARCH_LIMIT = 20

  def self.active
    knowledge_base = KnowledgeBase.first
    knowledge_base if knowledge_base&.active?
  end

  def self.published_answers
    knowledge_base = active
    return KnowledgeBase::Answer.none if !knowledge_base

    KnowledgeBase::Answer.published.where(category: knowledge_base.categories)
  end

  def self.kb_locale(user)
    locales = KnowledgeBase.first.kb_locales
    locale  = user.preferences['locale'].presence || Locale.default

    locales.joins(:system_locale).find_by(locales: { locale: }) || locales.find_by(primary: true)
  end

  # The top topics (no category), or a topic with its sub-topics and its own answers. nil when the
  # topic has nothing published.
  def self.topic(user, category = nil)
    knowledge_base = active
    return if !knowledge_base

    categories = knowledge_base.categories.sorted.to_a
    counts     = answer_counts(categories)
    return if category && counts[category.id].to_i.zero?

    kb_locale = kb_locale(user)
    {
      topic:   category && { id: category.id, title: title(category, kb_locale), path: path(category.parent, kb_locale) },
      topics:  categories
        .select { |child| child.parent_id == category&.id && counts[child.id].positive? }
        .map { |child| { id: child.id, title: title(child, kb_locale), icon: child.category_icon, answer_count: counts[child.id] } },
      answers: answers_in(category, kb_locale),
    }
  end

  def self.answer(user, answer)
    kb_locale   = kb_locale(user)
    translation = answer.translation_preferred(kb_locale)

    {
      id:          answer.id,
      title:       translation.title,
      body:        body(translation.content&.body_with_urls.to_s),
      updated_at:  translation.updated_at,
      path:        path(answer.category, kb_locale),
      attachments: answer.attachments.map { |file| { id: file.id, filename: file.filename, size: file.size.to_i } },
      helpful:     StudenthubAnswerFeedback.find_by(answer:, user:)&.helpful,
    }
  end

  # Answers named after the words come before those that only mention them.
  def self.search(user, query)
    knowledge_base = active
    return [] if !knowledge_base || query.blank?

    words     = query.to_s.strip
    kb_locale = kb_locale(user)

    found_translations(knowledge_base, words)
      .partition { |translation| translation.title.downcase.include?(words.downcase) }
      .flatten
      .first(SEARCH_LIMIT)
      .map { |translation| search_row(translation, kb_locale) }
  end

  # Zammad's Knowledge Base search without a user: given one, it also finds drafts and internal
  # answers for staff who edit the Knowledge Base. No highlights, which nothing shows: Elasticsearch
  # refuses to highlight text longer than the index allows (index.highlight.max_analyzed_offset).
  def self.found_translations(knowledge_base, words)
    ids = SearchKnowledgeBaseBackend
      .new(knowledge_base:, flavor: :public, index: KnowledgeBase::Answer::Translation.name, highlight_enabled: false)
      .search(words, user: nil)
      .pluck(:id)

    translations = KnowledgeBase::Answer::Translation.where(id: ids).includes(:content, answer: :category).index_by(&:id)
    ids.filter_map { |id| translations[id] }.uniq(&:answer_id)
  end

  def self.search_row(translation, kb_locale)
    {
      id:      translation.answer_id,
      title:   translation.title,
      topic:   title(translation.answer.category, kb_locale),
      snippet: Service::StudenthubKnowledgeBase::Search.snippet(translation.content&.body.to_s),
    }
  end

  # Published answers in each topic, counting its sub-topics'.
  def self.answer_counts(categories)
    own      = published_answers.group(:category_id).count
    children = categories.group_by(&:parent_id)
    total    = ->(category) { own.fetch(category.id, 0) + children.fetch(category.id, []).sum(&total) }

    categories.to_h { |category| [category.id, total.call(category)] }
  end

  def self.answers_in(category, kb_locale)
    return [] if !category

    published_answers.where(category:).sorted.map do |answer|
      { id: answer.id, title: answer.translation_preferred(kb_locale).title }
    end
  end

  # The topics from the top down to this one.
  def self.path(category, kb_locale)
    return [] if !category

    path(category.parent, kb_locale) + [{ id: category.id, title: title(category, kb_locale) }]
  end

  def self.title(category, kb_locale)
    category.translation_preferred(kb_locale).title
  end

  # Links to other answers open them in the app, and videos play as in the help center.
  def self.body(html)
    scrubber = Loofah::Scrubber.new do |node|
      next if node.name != 'a' || node['data-target-type'] != 'knowledge-base-answer'

      answer_id    = KnowledgeBase::Answer::Translation.find_by(id: node['data-target-id'])&.answer_id
      node['href'] = answer_id ? "/mobile/knowledge-base/answers/#{answer_id}" : '#'
    end

    ApplicationController.helpers.prepare_rich_text_videos(Loofah.scrub_fragment(html, scrubber).to_s)
  end

  private_class_method :active, :found_translations, :search_row, :answer_counts, :answers_in, :path, :title, :body
end
