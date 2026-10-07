# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: Knowledge Base answers matching a search, for the new UI's search (top bar and the
# Knowledge Base page). Uses Zammad's own Knowledge Base search (Elasticsearch, or the database when
# it isn't running) with the agent's read rights; one row per answer, newest change first.
class Service::StudenthubKnowledgeBase::Search < Service::Base
  SNIPPET_LENGTH = 160

  attr_reader :user, :query, :limit

  def initialize(user:, query:, limit: 10)
    super()
    @user  = user
    @query = query.to_s.strip
    @limit = limit.to_i.clamp(1, 50)
  end

  def execute
    knowledge_base = KnowledgeBase.first
    return [] if !knowledge_base || query.blank?

    translations(knowledge_base)
      .uniq(&:answer_id)
      .first(limit)
      .map { |translation| row(translation) }
  end

  private

  def translations(knowledge_base)
    ids = SearchKnowledgeBaseBackend
      .new(knowledge_base:, flavor: :agent, index: KnowledgeBase::Answer::Translation.name, order_by: { updated_at: :desc })
      .search(query, user:)
      .pluck(:id)

    records = KnowledgeBase::Answer::Translation.where(id: ids).includes(:content, :answer).index_by(&:id)
    ids.filter_map { |id| records[id] }
  end

  # Plain words: a space between paragraphs and lines, entities such as &nbsp; decoded.
  def snippet(html)
    spaced = html.gsub(%r{<(?:br|/p|/div|/li|/h\d)[^>]*>}i, ' \\0')
    Nokogiri::HTML5.fragment(spaced).text.squish.truncate(SNIPPET_LENGTH)
  end

  def row(translation)
    answer = translation.answer

    {
      id:           answer.id,
      kb_locale_id: translation.kb_locale_id,
      title:        translation.title,
      snippet:      snippet(translation.content&.body.to_s),
      category_id:  answer.category_id,
      state:        Service::StudenthubKnowledgeBase::Tree.state(answer),
      updated_at:   translation.updated_at,
    }
  end
end
