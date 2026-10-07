# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/manager_sites',          to: 'studenthub_manager_sites#index',  via: :get
  match api_path + '/studenthub/manager_sites/stats',    to: 'studenthub_manager_sites#stats',  via: :get
  match api_path + '/studenthub/manager_sites/:user_id', to: 'studenthub_manager_sites#update', via: :put
end
