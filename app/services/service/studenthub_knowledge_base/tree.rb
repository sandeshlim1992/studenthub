# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Knowledge Base page of the new UI. The categories and answers the user may see,
# with their titles in each language and what the user may edit. Visibility follows Zammad's own
# rules (KnowledgeBase::AccessibleCategories: by role, or per category when granular permissions
# are set); saving goes through Zammad's Knowledge Base API, which checks them again.
class Service::StudenthubKnowledgeBase::Tree < Service::Base
  attr_reader :user

  def initialize(user:)
    super()
    @user = user
  end

  def execute
    knowledge_base = KnowledgeBase.first
    return { knowledge_base: nil, categories: [], answers: [] } if !knowledge_base

    access     = KnowledgeBase::AccessibleCategories.for_user(user)
    editor_ids = access.editor.to_set(&:id)

    {
      knowledge_base: knowledge_base_row(knowledge_base),
      categories:     categories(access, editor_ids),
      answers:        answers(access, editor_ids),
    }
  end

  def self.state(answer)
    answer.can_be_published_aasm.current_state.to_s
  end

  def self.titles(translations)
    translations.to_h { |translation| [translation.kb_locale_id, translation.title] }
  end

  private

  def knowledge_base_row(knowledge_base)
    {
      id:                  knowledge_base.id,
      active:              knowledge_base.active,
      titles:              self.class.titles(knowledge_base.translations),
      locales:             knowledge_base.kb_locales.includes(:system_locale).map do |kb_locale|
        { id: kb_locale.id, locale: kb_locale.system_locale.locale, name: kb_locale.system_locale.name, primary: kb_locale.primary }
      end,
      can_create_category: KnowledgeBase::EffectivePermission.new(user, knowledge_base).access_effective == 'editor',
    }
  end

  def categories(access, editor_ids)
    KnowledgeBase::Category.where(id: access.visible.map(&:id)).includes(:translations).map do |category|
      {
        id:              category.id,
        parent_id:       category.parent_id,
        position:        category.position,
        icon:            category.category_icon,
        titles:          self.class.titles(category.translations),
        translation_ids: category.translations.to_h { |translation| [translation.kb_locale_id, translation.id] },
        editable:        editor_ids.include?(category.id),
      }
    end
  end

  def answers(access, editor_ids)
    KnowledgeBase::Answer.visible_by_categories(access).includes(:translations).map do |answer|
      {
        id:          answer.id,
        category_id: answer.category_id,
        position:    answer.position,
        promoted:    answer.promoted,
        state:       self.class.state(answer),
        titles:      self.class.titles(answer.translations),
        updated_at:  answer.updated_at,
        editable:    editor_ids.include?(answer.category_id),
      }
    end
  end
end
