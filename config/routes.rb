# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Rails.application.routes.draw do

  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html

  # app init
  match '/init', to: 'init#index', via: :get
  match '/app',  to: 'init#index', via: :get

  # just remember to delete public/index.html.
  # Student Hub: the new UI is served at / (Studenthub::NewUiAtRoot); the classic UI stays at /app
  root to: 'desktop#index', via: :get
  root to: 'errors#routing', via: %i[post put delete options], as: nil

  # load routes from external files
  dir = File.expand_path(__dir__)
  files = Dir.glob("#{dir}/routes/*.rb")
  files.each do |file|
    load file
  end

  # Student Hub: every other page address opens the new UI, which shows its own "not found"
  get '*path', to: 'desktop#index', format: false, constraints: ->(request) { Studenthub::NewUiAtRoot.page?(request) }

  match '*a', to: 'errors#routing', via: %i[get post put delete options]
end
