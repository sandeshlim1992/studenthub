# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins who manage checklist templates choose which sub-categories get them automatically.
class Controllers::StudenthubChecklistAssignmentsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(Studenthub::ChecklistAssignments::PERMISSION)
end
