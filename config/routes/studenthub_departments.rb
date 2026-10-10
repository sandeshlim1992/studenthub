# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/departments',     to: 'studenthub_departments#index',   via: :get
  match api_path + '/studenthub/departments',     to: 'studenthub_departments#create',  via: :post
  match api_path + '/studenthub/departments/:id', to: 'studenthub_departments#update',  via: :put
  match api_path + '/studenthub/departments/:id', to: 'studenthub_departments#destroy', via: :delete
end
