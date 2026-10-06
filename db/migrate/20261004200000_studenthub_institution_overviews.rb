# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: overviews for admins (the "Institutions" group of the new UI's views panel). Since
# 6 Oct 2026 one per organisation (Studenthub::TicketViews::Institutions), no longer by campus.
class StudenthubInstitutionOverviews < ActiveRecord::Migration[8.0]
  def up
    Studenthub::TicketViews::Setup.ensure!
  end

  def down
    Studenthub::TicketViews::Setup.remove!
  end
end
