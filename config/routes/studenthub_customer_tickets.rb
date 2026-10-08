# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/customer_tickets/:id',        to: 'studenthub_customer_tickets#show',   via: :get
  match api_path + '/studenthub/customer_tickets/:id/close',  to: 'studenthub_customer_tickets#close',  via: :post
  match api_path + '/studenthub/customer_tickets/:id/reopen', to: 'studenthub_customer_tickets#reopen', via: :post
  match api_path + '/studenthub/customer_tickets/:id/rating', to: 'studenthub_customer_tickets#rating', via: :post
end
