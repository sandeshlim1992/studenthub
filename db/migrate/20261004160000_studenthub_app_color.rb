# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admin-selectable application colour for the new UI (Branding).
# No "new setup" guard, so fresh and existing systems both get the setting.
class StudenthubAppColor < ActiveRecord::Migration[8.0]
  def up
    Studenthub::Theme::Setup.ensure!
  end

  def down
    Studenthub::Theme::Setup.remove!
  end
end
