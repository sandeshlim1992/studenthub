# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/dashboard/overview', to: 'studenthub_dashboard#overview', via: :get
  match api_path + '/studenthub/dashboard/activity', to: 'studenthub_dashboard#activity', via: :get
end
