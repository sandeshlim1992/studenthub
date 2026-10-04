# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# zammad:db:reset empties every table and re-runs only Zammad's own seeds, so the
# permissions, Managers role, setting, overviews and field definitions created by the
# Ticket Approvals migration must be put back for the suite.
RSpec.configure do |config|
  config.before :suite do
    Studenthub::TicketApproval::Setup.ensure!
    Rails.cache.clear
  end
end
