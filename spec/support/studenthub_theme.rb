# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# zammad:db:reset re-runs only Zammad's own seeds, so put back the Student Hub theme settings.
RSpec.configure do |config|
  config.before :suite do
    Studenthub::Theme::Setup.ensure!
    Studenthub::Theme::TicketListSetup.ensure!
    Rails.cache.clear
  end
end
