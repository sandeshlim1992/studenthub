# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Rails.application.routes.draw do

  # For details on the DSL available within this file, see https://guides.rubyonrails.org/routing.html

  # Student Hub: the classic UI is switched off (.dev/classic-ui-removal.md): its addresses open the new UI.
  # Browsers keep the #… part through the redirect, so /app#ticket/zoom/5 opens that ticket. A 302, so an undo
  # isn't stuck in browsers' caches.
  match '/init', to: redirect('/', status: 302), via: :get
  match '/app',  to: redirect('/', status: 302), via: :get

  # just remember to delete public/index.html.
  # Student Hub: the new UI is served at / (Studenthub::NewUiAtRoot)
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
