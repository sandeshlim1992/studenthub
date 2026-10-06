# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: ticket state colours are a map of state ID → palette key. Only the fixed palette
# is allowed, because every palette colour is checked for readable text (WCAG AA).
class Setting::Validation::StudenthubTicketStateColors < Setting::Validation::Base
  STATE_ID = %r{\A[1-9]\d*\z}

  def run
    return result_failed(__('Ticket state colours must be a list of states and colours.')) if !value.is_a?(Hash)

    value.each do |state_id, color|
      return result_failed(__('Ticket state colours contain an invalid state.')) if !state_id.to_s.match?(STATE_ID)
      if Studenthub::Theme::TicketListSetup::STATE_COLORS.exclude?(color)
        return result_failed(format(__('"%s" is not one of the available colours.'), color))
      end
    end

    result_success
  end
end
