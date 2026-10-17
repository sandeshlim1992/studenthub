# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the mobile app's popular answers setting (Studenthub::MobileApp). New systems get it
# after db:seed (Studenthub::Setup).
class StudenthubMobilePopularAnswers < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::MobileApp.ensure!
  end
end
