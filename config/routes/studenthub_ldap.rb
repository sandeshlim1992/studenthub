# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/ldap', to: 'studenthub_ldap#show',   via: :get
  match api_path + '/studenthub/ldap', to: 'studenthub_ldap#update', via: :put
end
