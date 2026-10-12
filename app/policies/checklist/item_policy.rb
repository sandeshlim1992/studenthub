# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Checklist::ItemPolicy < ApplicationPolicy
  delegate :show?, :update?, :manage?, to: :checklist_policy

  # Student Hub: adding and deleting items is for checklist admins (Studenthub::ChecklistRules).
  def create?
    checklist_policy.manage?
  end

  def destroy?
    checklist_policy.manage?
  end

  private

  def checklist_policy
    ChecklistPolicy.new(user, record&.checklist)
  end
end
