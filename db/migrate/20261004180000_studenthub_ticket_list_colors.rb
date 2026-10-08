# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admin-selectable ticket state colours and "due soon" point for the new UI's
# ticket lists (Branding). New systems get them after db:seed (Studenthub::Setup).
class StudenthubTicketListColors < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::Theme::TicketListSetup.ensure!
  end

  def down
    Studenthub::Theme::TicketListSetup.remove!
  end
end
