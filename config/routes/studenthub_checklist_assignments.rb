# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/checklist_assignments',                        to: 'studenthub_checklist_assignments#index',      via: :get
  match api_path + '/studenthub/checklist_assignments/ticket/:ticket_id',      to: 'studenthub_checklist_assignments#for_ticket', via: :get
  match api_path + '/studenthub/checklist_assignments/:checklist_template_id', to: 'studenthub_checklist_assignments#update',     via: :put
end
