# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins who may change any of the records the condition and action editors are used for.
class Controllers::StudenthubAutomationControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! :options, to: %w[admin.scheduler admin.trigger admin.macro admin.template admin.sla admin.report_profile admin.time_accounting]
end
