# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the new UI's Exchange page never receives the stored password (it shows a mask). When
# the mask comes back for loading folders, fields or a trial run, Zammad's Exchange endpoints use the
# stored password instead, and so does saving the page (Service::StudenthubExchange::Settings).
module Studenthub::ExchangeStoredPassword
  PASSWORD_MASK = '**********'.freeze

  # The password for `config` (endpoint, user, password): the stored one when the mask came back.
  # The mask stands for it only with the stored server address and user name; with any other, the
  # stored password would go to whichever server the request names, so it must be entered again.
  def self.password_for(config, stored = Setting.get('exchange_config').to_h)
    config = config.to_h.with_indifferent_access
    return config[:password] if config[:password] != PASSWORD_MASK

    stored = stored.to_h.with_indifferent_access
    if %i[endpoint user].any? { |key| config[key].to_s.strip != stored[key].to_s.strip }
      raise Exceptions::UnprocessableContent, __('The server address or user name has changed. Please enter the password again.')
    end

    stored[:password]
  end

  private

  def ews_config
    config = super
    config[:password] = Studenthub::ExchangeStoredPassword.password_for(config)
    config
  end
end
