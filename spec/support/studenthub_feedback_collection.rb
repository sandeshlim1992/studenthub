# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# zammad:db:reset (spec/support/db_initial_state.rb) empties every table and re-runs only
# Zammad's own seeds, so the Feedback Collection permission and settings that its
# migration created must be put back for the suite.
RSpec.configure do |config|
  config.before :suite do
    Studenthub::FeedbackCollection::Setup.ensure!
    Rails.cache.clear
  end
end
