# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admin-selectable application colour for the new UI (Branding).
# New systems get the setting after db:seed (Studenthub::Setup).
class StudenthubAppColor < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::Theme::Setup.ensure!
  end

  def down
    Studenthub::Theme::Setup.remove!
  end
end
