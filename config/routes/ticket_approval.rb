# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/tickets/:ticket_id/approval',         to: 'ticket_approvals#show',            via: :get
  match api_path + '/tickets/:ticket_id/approval',         to: 'ticket_approvals#create',          via: :post
  match api_path + '/tickets/:ticket_id/approval',         to: 'ticket_approvals#destroy',         via: :delete
  match api_path + '/tickets/:ticket_id/approval/approve', to: 'ticket_approvals#approve',         via: :post
  match api_path + '/tickets/:ticket_id/approval/deny',    to: 'ticket_approvals#deny',            via: :post

  match api_path + '/ticket_approval/viewer',              to: 'ticket_approvals#viewer',          via: :get
  match api_path + '/ticket_approval/dashboard',           to: 'ticket_approvals#dashboard',       via: :get
  match api_path + '/ticket_approval/managers',            to: 'ticket_approvals#managers',        via: :get
  match api_path + '/ticket_approval/settings',            to: 'ticket_approvals#settings',        via: :get
  match api_path + '/ticket_approval/settings',            to: 'ticket_approvals#update_settings', via: :put
end
