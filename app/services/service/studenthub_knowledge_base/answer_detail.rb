# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: one Knowledge Base answer for the new UI, with its text in each language, its
# attachments and tags, and whether the user may edit it. The caller checks that the user may see
# it (KnowledgeBase::AnswerPolicy#show?).
class Service::StudenthubKnowledgeBase::AnswerDetail < Service::Base
  attr_reader :user, :answer

  def initialize(user:, answer:)
    super()
    @user   = user
    @answer = answer
  end

  def execute
    {
      id:                answer.id,
      knowledge_base_id: answer.category.knowledge_base_id,
      category_id:       answer.category_id,
      state:             Service::StudenthubKnowledgeBase::Tree.state(answer),
      promoted:          answer.promoted,
      editable:          KnowledgeBase::AnswerPolicy.new(user, answer).update?,
      translations:      answer.translations.includes(:content).map { |translation| translation_row(translation) },
      attachments:       answer.attachments.map { |file| attachment_row(file) },
      tags:              answer.tag_list,
      updated_at:        answer.updated_at,
      **publishing_times,
    }
  end

  private

  def publishing_times
    { internal_at: answer.internal_at, published_at: answer.published_at, archived_at: answer.archived_at }
  end

  def translation_row(translation)
    {
      id:           translation.id,
      kb_locale_id: translation.kb_locale_id,
      title:        translation.title,
      content_id:   translation.content&.id,
      body:         translation.content&.body_with_urls.to_s,
      updated_at:   translation.updated_at,
      updated_by:   User.lookup(id: translation.updated_by_id)&.fullname,
    }
  end

  def attachment_row(file)
    {
      id:           file.id,
      filename:     file.filename,
      size:         file.size.to_i,
      content_type: file.preferences['Content-Type'] || file.preferences['Mime-Type'],
    }
  end
end
