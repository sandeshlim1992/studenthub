# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::StudenthubRolesControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!('admin.role')
end
