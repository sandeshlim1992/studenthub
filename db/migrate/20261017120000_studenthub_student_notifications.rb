# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: notifications for students about their tickets (Transaction::StudenthubStudentNotification),
# registered by Studenthub::MobileApp. New systems get it after db:seed (Studenthub::Setup).
class StudenthubStudentNotifications < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::MobileApp.ensure!
  end
end
