# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: LSST, UKBC and FSB overviews for admins (the "Institutions" group of the new UI's
# views panel). Only created where the campus field exists.
class StudenthubInstitutionOverviews < ActiveRecord::Migration[8.0]
  def up
    Studenthub::TicketViews::Setup.ensure!
  end

  def down
    Studenthub::TicketViews::Setup.remove!
  end
end
