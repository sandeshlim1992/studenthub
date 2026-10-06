# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the application colour sits behind white text (navigation, buttons, the
# sign-in brand panel), so it must be a hex colour dark enough to keep that text readable.
class Setting::Validation::StudenthubAppColor < Setting::Validation::Base
  HEX = %r{\A#[0-9a-fA-F]{6}\z}
  MIN_CONTRAST = 4.5

  def run
    return result_failed(__('Choose a colour in the format #rrggbb.')) if !value.is_a?(String) || !value.match?(HEX)

    contrast = self.class.contrast_with_white(value)
    if contrast < MIN_CONTRAST
      return result_failed(format(__('This colour is too light for white text (%s:1). Choose a darker colour with at least 4.5:1.'), contrast.round(2)))
    end

    result_success
  end

  # WCAG 2 contrast ratio between the colour and white.
  def self.contrast_with_white(hex)
    channels = hex.delete('#').scan(%r{..}).map { |pair| pair.to_i(16) / 255.0 }
    linear = channels.map { |c| c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055)**2.4 }
    luminance = (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2])
    1.05 / (luminance + 0.05)
  end
end
