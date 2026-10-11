# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# zammad:db:reset empties every table and re-runs only Zammad's own seeds, so the permission and
# on/off setting created by the departments migrations must be put back for the suite.
RSpec.configure do |config|
  config.before :suite do
    Studenthub::Departments.ensure!
    Rails.cache.clear
  end
end
