# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The Knowledge Base page of the new UI is for staff (agents, admins, managers) with Knowledge Base
# access; students read the public help center.
class Controllers::StudenthubKnowledgeBaseControllerPolicy < Controllers::ApplicationControllerPolicy
  def index?
    staff_with_knowledge_base?
  end

  def answer?
    staff_with_knowledge_base?
  end

  def search?
    staff_with_knowledge_base?
  end

  private

  def staff_with_knowledge_base?
    return true if user.permissions?(%w[ticket.agent admin]) && user.permissions?(%w[knowledge_base.editor knowledge_base.reader])

    not_authorized __('Only staff with Knowledge Base access can open the Knowledge Base here.')
  end
end
