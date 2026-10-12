# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class ChecklistPolicy < ApplicationPolicy
  def show?
    check_prerequisites? && ticket_policy.agent_read_access?
  end

  # Student Hub: ticking items (Studenthub::ChecklistRules).
  def update?
    check_prerequisites? && ticket_policy.agent_update_access?
  end

  # Student Hub: everything else, checklist admins only.
  def manage?
    update? && Studenthub::ChecklistRules.manage?(user)
  end

  def destroy?
    manage?
  end

  private

  def check_prerequisites?
    Setting.get('checklist') && record&.ticket
  end

  def ticket_policy
    TicketPolicy.new(user, record.ticket)
  end
end
