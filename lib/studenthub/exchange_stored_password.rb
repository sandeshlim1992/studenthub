# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the new UI's Exchange page never receives the stored password (it shows a mask). When
# the mask comes back for loading folders, fields or a trial run, Zammad's Exchange endpoints use the
# stored password instead.
module Studenthub::ExchangeStoredPassword
  PASSWORD_MASK = '**********'.freeze

  private

  def ews_config
    config = super
    config[:password] = Setting.get('exchange_config').to_h['password'] if config[:password] == PASSWORD_MASK
    config
  end
end
