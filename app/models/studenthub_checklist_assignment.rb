# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# A checklist added automatically (Studenthub::ChecklistAssignments): tickets in this
# Category › Sub-category get this checklist template. One template per pair.
class StudenthubChecklistAssignment < ApplicationModel
  belongs_to :checklist_template

  before_validation :tidy

  validate :sub_category_given
  validate :sub_category_free

  # The pair is no longer offered by the Category / Sub-category fields (an admin changed them).
  def missing?
    !Studenthub::ChecklistAssignments.offered?(category, sub_category)
  end

  private

  def tidy
    self.category     = category.to_s.strip
    self.sub_category = sub_category.to_s.strip
  end

  def sub_category_given
    errors.add(:base, __('Choose a category and a sub-category.')) if category.blank? || sub_category.blank?
  end

  def sub_category_free
    taken = self.class.where.not(id: id).find_by(category: category, sub_category: sub_category)
    return if !taken

    errors.add(:base, format(__('%1$s › %2$s already gets the checklist "%3$s".'), category, sub_category, taken.checklist_template&.name))
  end
end
