# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/request_forms',                to: 'studenthub_request_forms#index',      via: :get
  match api_path + '/studenthub/request_forms',                to: 'studenthub_request_forms#create',     via: :post
  match api_path + '/studenthub/request_forms/applicable',     to: 'studenthub_request_forms#applicable', via: :get
  match api_path + '/studenthub/request_forms/:id',            to: 'studenthub_request_forms#update',     via: :put
  match api_path + '/studenthub/request_forms/:id',            to: 'studenthub_request_forms#destroy',    via: :delete
  match api_path + '/studenthub/request_forms/:id/publish',    to: 'studenthub_request_forms#publish',    via: :post
  match api_path + '/studenthub/request_forms/:id/unpublish',  to: 'studenthub_request_forms#unpublish',  via: :post
  match api_path + '/studenthub/request_forms/:id/discard',    to: 'studenthub_request_forms#discard',    via: :post
end
