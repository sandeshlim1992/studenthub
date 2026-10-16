# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the Mobile app admin page's permission and the quick links setting
# (Studenthub::MobileApp). New systems get them after db:seed (Studenthub::Setup).
class StudenthubMobileApp < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::MobileApp.ensure!
  end

  def down
    Studenthub::MobileApp.remove!
  end
end
