# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins who may change scheduler jobs or triggers.
class Controllers::StudenthubAutomationControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! :options, to: %w[admin.scheduler admin.trigger]
end
