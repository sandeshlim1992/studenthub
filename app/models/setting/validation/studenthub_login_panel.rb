# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the sign-in page texts are plain text (shown as text, never as HTML), one per
# field, each within its length limit. An empty text is allowed and hides that line.
class Setting::Validation::StudenthubLoginPanel < Setting::Validation::Base
  def run
    return result_failed(__('The sign-in page texts must be a heading, a tagline and a description.')) if !value.is_a?(Hash)

    max_lengths = Studenthub::Theme::LoginPanelSetup::MAX_LENGTHS

    value.each do |field, text|
      return result_failed(format(__('"%s" is not a sign-in page text.'), field)) if !max_lengths.key?(field.to_s)
      return result_failed(format(__('The %s must be text.'), field)) if !text.is_a?(String)
      if text.length > max_lengths[field.to_s]
        return result_failed(format(__('The %1$s can be at most %2$s characters long.'), field, max_lengths[field.to_s]))
      end
    end

    result_success
  end
end
