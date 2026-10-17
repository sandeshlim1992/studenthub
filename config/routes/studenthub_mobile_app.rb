# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/mobile_app/answer_choices',                       to: 'studenthub_mobile_app#answer_choices',          via: :get
  match api_path + '/studenthub/mobile_app/popular_answers',                      to: 'studenthub_mobile_app#popular_answers',         via: :get
  match api_path + '/studenthub/mobile_app/knowledge_base',                       to: 'studenthub_mobile_app#knowledge_base_topic',    via: :get
  match api_path + '/studenthub/mobile_app/knowledge_base/categories/:id',        to: 'studenthub_mobile_app#knowledge_base_topic',    via: :get
  match api_path + '/studenthub/mobile_app/knowledge_base/answers/:id',           to: 'studenthub_mobile_app#knowledge_base_answer',   via: :get
  match api_path + '/studenthub/mobile_app/knowledge_base/answers/:id/feedback',  to: 'studenthub_mobile_app#knowledge_base_feedback', via: :put
  match api_path + '/studenthub/mobile_app/knowledge_base/search',                to: 'studenthub_mobile_app#knowledge_base_search',   via: :get
end
