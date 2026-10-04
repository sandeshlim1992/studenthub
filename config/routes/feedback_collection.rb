# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  # public feedback page, linked from the feedback request email
  match '/feedback/:token',        to: 'feedback#show',   via: :get,  constraints: { token: %r{[A-Za-z0-9]{8,128}} }
  match '/feedback/:token',        to: 'feedback#submit', via: :post, constraints: { token: %r{[A-Za-z0-9]{8,128}} }
  match '/feedback/:token/thanks', to: 'feedback#thanks', via: :get,  constraints: { token: %r{[A-Za-z0-9]{8,128}} }

  # admin API
  match api_path + '/feedback_collection/requests',            to: 'feedback_collection#index',           via: :get
  match api_path + '/feedback_collection/requests/:id',        to: 'feedback_collection#show',            via: :get
  match api_path + '/feedback_collection/requests/:id',        to: 'feedback_collection#destroy',         via: :delete
  match api_path + '/feedback_collection/export',              to: 'feedback_collection#export',          via: :get
  match api_path + '/feedback_collection/report',              to: 'feedback_collection#report',          via: :get
  match api_path + '/feedback_collection/settings',            to: 'feedback_collection#settings',        via: :get
  match api_path + '/feedback_collection/settings',            to: 'feedback_collection#update_settings', via: :put
  match api_path + '/feedback_collection/preview',             to: 'feedback_collection#preview',         via: :post
  match api_path + '/feedback_collection/test_email',          to: 'feedback_collection#test_email',      via: :post

  # agents: rating shown in the ticket sidebar
  match api_path + '/feedback_collection/tickets/:ticket_id',  to: 'feedback_collection#ticket',          via: :get
end
