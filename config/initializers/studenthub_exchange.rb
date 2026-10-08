# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Rails.application.config.to_prepare do
  ExternalCredential::Exchange.singleton_class.prepend(Studenthub::ExchangeReturn)
  Integration::ExchangeController.prepend(Studenthub::ExchangeStoredPassword)
end
