# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Creates the records Student Hub needs (permissions, roles, settings, overviews, views).
#
# On a new database Zammad runs every migration first and seeds afterwards, so the Student Hub
# migrations can't create records yet (they need user #1 and Zammad's roles and states). They
# only change the schema there, and lib/tasks/studenthub_setup.rake runs ensure_all! after
# db:seed. On seeded systems the migrations create the records themselves. Idempotent.
module Studenthub::Setup
  # Zammad's own "new setup" check: the settings exist once the database has been seeded.
  def self.seeded?
    Setting.exists?(name: 'system_init_done')
  end

  def self.ensure_all!
    Studenthub::FeedbackCollection::Setup.ensure!
    Studenthub::TicketApproval::Setup.ensure!
    Studenthub::TicketApproval::Setup.sync_overviews
    Studenthub::Theme::Setup.ensure!
    Studenthub::Theme::TicketListSetup.ensure!
    Studenthub::TicketViews::Teams.sync!
    Studenthub::TicketViews::Institutions.sync!
    Setting.set('user_create_account', false)
  end
end
