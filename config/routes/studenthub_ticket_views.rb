# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/ticket_views', to: 'studenthub_ticket_views#index', via: :get
  match api_path + '/studenthub/ticket_views/:overview_id/choice', to: 'studenthub_ticket_views#choice',        via: :get
  match api_path + '/studenthub/ticket_views/:overview_id/choice', to: 'studenthub_ticket_views#update_choice', via: :put
  match api_path + '/studenthub/ticket_views/:overview_id/choice', to: 'studenthub_ticket_views#reset_choice',  via: :delete
  match api_path + '/studenthub/sla_preview',  to: 'studenthub_sla_previews#show',  via: :get
end
