# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::StudenthubDashboardControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!('admin')
  permit! %i[activity unassigned], to: %w[ticket.agent admin]
end
