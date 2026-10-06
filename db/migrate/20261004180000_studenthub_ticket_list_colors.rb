# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admin-selectable ticket state colours and "due soon" point for the new UI's
# ticket lists (Branding). No "new setup" guard, so fresh and existing systems both get them.
class StudenthubTicketListColors < ActiveRecord::Migration[8.0]
  def up
    Studenthub::Theme::TicketListSetup.ensure!
  end

  def down
    Studenthub::Theme::TicketListSetup.remove!
  end
end
