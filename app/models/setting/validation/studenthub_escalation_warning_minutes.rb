# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: how many minutes before the escalation time ticket lists show "due soon".
# Capped at 48 hours, the longest Student Hub SLA.
class Setting::Validation::StudenthubEscalationWarningMinutes < Setting::Validation::Base
  RANGE = (1..2880)

  def run
    return result_failed(__('Choose a number of minutes between 1 and 2880.')) if !value.is_a?(Integer) || RANGE.exclude?(value)

    result_success
  end
end
