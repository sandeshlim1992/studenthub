# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub records for new databases, after Zammad's seeds (see Studenthub::Setup).
# Not in the test environment: zammad:db:reset re-seeds between suites, and spec/support puts
# back only what the specs need, so Zammad's own specs keep their defaults (e.g. self-signup).
Rake::Task['db:seed'].enhance do
  next if Rails.env.test?
  next if !Studenthub::Setup.seeded?

  Studenthub::Setup.ensure_all!
end
