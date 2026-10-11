# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

Zammad::Application.routes.draw do
  # Student Hub: the new UI is served at / (Studenthub::NewUiAtRoot), so old /desktop/… links go to
  # the same page there. 302, not 301: browsers would keep a 301 even after an undo.
  get '/desktop(/*path)', format: false, to: redirect(status: 302) { |params, request|
    Studenthub::NewUiAtRoot.without_desktop(params[:path], request.query_string)
  }
end
