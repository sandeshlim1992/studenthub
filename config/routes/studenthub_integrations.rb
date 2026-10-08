# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/integrations/exchange', to: 'studenthub_integrations#exchange',            via: :get
  match api_path + '/studenthub/integrations/exchange', to: 'studenthub_integrations#update_exchange',     via: :put
  match api_path + '/studenthub/integrations/:kind',    to: 'studenthub_integrations#secure_email',        via: :get, constraints: { kind: %r{smime|pgp} }
  match api_path + '/studenthub/integrations/:kind',    to: 'studenthub_integrations#update_secure_email', via: :put, constraints: { kind: %r{smime|pgp} }
end
