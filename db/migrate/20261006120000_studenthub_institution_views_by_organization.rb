# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Institutions views are now one per active organisation (its open tickets,
# Admin role only) instead of LSST / UKBC / FSB by campus. Afterwards they follow the
# organisations by themselves (Studenthub::TicketViews::Institutions).
class StudenthubInstitutionViewsByOrganization < ActiveRecord::Migration[8.0]
  def up
    Studenthub::TicketViews::Institutions.sync!
  end
end
