# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

FactoryBot.define do
  # Student Hub: an agent who may also manage ticket checklists (Studenthub::ChecklistRules); plain
  # agents only tick items.
  factory :checklist_admin_agent, parent: :agent do
    roles { [*Role.where(name: 'Agent'), association(:role, permission_names: %w[admin.checklist])] }
  end
end
