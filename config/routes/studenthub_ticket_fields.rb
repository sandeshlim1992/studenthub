# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/ticket_states',     to: 'studenthub_ticket_fields#states',              via: :get
  match api_path + '/studenthub/ticket_priorities', to: 'studenthub_ticket_fields#priorities',          via: :get
  match api_path + '/studenthub/tag_settings',      to: 'studenthub_ticket_fields#tag_settings',        via: :get
  match api_path + '/studenthub/tag_settings',      to: 'studenthub_ticket_fields#update_tag_settings', via: :put
end
