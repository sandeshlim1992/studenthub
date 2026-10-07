# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/knowledge_base',             to: 'studenthub_knowledge_base#index',  via: :get
  match api_path + '/studenthub/knowledge_base/search',      to: 'studenthub_knowledge_base#search', via: :get
  match api_path + '/studenthub/knowledge_base/answers/:id', to: 'studenthub_knowledge_base#answer', via: :get
end
