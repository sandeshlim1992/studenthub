# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the new UI is served at / (Zammad serves it at /desktop). The home address and
# every page the new UI has (/tickets, /ticket/…, /login, /manage…) render it (DesktopController);
# old /desktop/… links are sent to the same page without /desktop. Every file changed for this is
# listed in .dev/new-ui-at-root.md, with how to undo it. The classic UI's /app and /init redirect to
# / (.dev/classic-ui-removal.md).
module Studenthub::NewUiAtRoot
  # First path segments that belong to the server, not the new UI: a path there that no route
  # matches stays a 404 instead of opening the new UI.
  SERVER_PATHS = %w[
    api app assets auth cable calendar_subscriptions desktop feedback graphql help ical init mobile
    oauth rails robots.txt ws
  ].freeze

  # Route constraint for the catch-all in config/routes.rb.
  def self.page?(request)
    request.get? && request.format.html? && !server_path?(request.path.split('/')[1].to_s.downcase)
  end

  # Zammad's own test pages are /tests, /tests_core, /tests_ui…
  def self.server_path?(segment)
    SERVER_PATHS.include?(segment) || segment.start_with?('tests')
  end

  # /desktop/tickets/1?x=1 → /tickets/1?x=1. Leading slashes and backslashes are dropped: Rails
  # decodes /desktop/%2Fevil.example to the path "/evil.example", and //evil.example is another site.
  def self.without_desktop(path, query_string)
    target = "/#{path.to_s.sub(%r{\A[/\\]+}, '')}"
    query_string.present? ? "#{target}?#{query_string}" : target
  end

  # Where to go after a sign-in started in the new UI: its "redirect" parameter when it is a path
  # on this server, else the home page. Without the /desktop prefix in front, a value such as
  # //other.example would otherwise send people to another site.
  def self.local_path(path)
    path = path.to_s
    return '/' if !path.start_with?('/') || path.start_with?('//', '/\\')

    path
  end
end
