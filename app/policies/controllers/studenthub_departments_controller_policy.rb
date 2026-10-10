# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins with the departments permission manage the departments.
class Controllers::StudenthubDepartmentsControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!(Studenthub::Departments::PERMISSION)
end
