# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::ChecklistsControllerPolicy < Controllers::ApplicationControllerPolicy
  # Student Hub: agents add only the checklist assigned to the ticket's sub-category (Studenthub::ChecklistRules).
  def create?
    Setting.get('checklist') && Pundit.authorize(user, ticket, :agent_update_access?) &&
      Studenthub::ChecklistRules.may_add?(user, ticket, template)
  end

  # Student Hub: renaming and reordering, checklist admins only.
  def update?
    ChecklistPolicy
      .new(user, checklist)
      .manage?
  end

  def destroy?
    ChecklistPolicy
      .new(user, checklist)
      .destroy?
  end

  def show?
    ChecklistPolicy
      .new(user, checklist)
      .show?
  end

  private

  def checklist
    Checklist.lookup(id: record.params[:id])
  end

  def ticket
    Ticket.lookup(id: record.params[:ticket_id])
  end

  def template
    ChecklistTemplate.lookup(id: record.params[:template_id]) if record.params[:template_id].present?
  end
end
