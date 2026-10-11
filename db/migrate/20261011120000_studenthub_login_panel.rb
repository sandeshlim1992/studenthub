# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: admin-defined heading, tagline and description on the sign-in page (Branding).
# New systems get the setting after db:seed (Studenthub::Setup).
class StudenthubLoginPanel < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::Theme::LoginPanelSetup.ensure!
  end

  def down
    Studenthub::Theme::LoginPanelSetup.remove!
  end
end
