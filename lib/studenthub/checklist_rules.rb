# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: ticket checklists are made and assigned by admins (Studenthub::ChecklistAssignments).
# Agents only tick and untick their items; adding, editing, reordering or deleting items, renaming
# and removing a checklist need the checklist admin permission. An agent may add only the checklist
# assigned to the ticket's Category › Sub-category (tickets that were there before it was assigned).
module Studenthub::ChecklistRules
  PERMISSION = 'admin.checklist'.freeze

  def self.manage?(user)
    user.present? && user.permissions?(PERMISSION)
  end

  def self.may_add?(user, ticket, template)
    return true if manage?(user)

    template.present? && Studenthub::ChecklistAssignments.template_for_ticket(ticket) == template
  end

  # Only the checked state changes: what an agent may do.
  def self.tick_only?(changes)
    changes.to_h.compact.keys.map(&:to_s) == ['checked']
  end
end
