# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  api_path = Rails.configuration.api_path

  match api_path + '/studenthub/mobile_app/answer_choices',  to: 'studenthub_mobile_app#answer_choices',  via: :get
  match api_path + '/studenthub/mobile_app/popular_answers', to: 'studenthub_mobile_app#popular_answers', via: :get
end
