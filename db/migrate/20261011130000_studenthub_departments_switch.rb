# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: on/off switch for departments (setting studenthub_departments, off), which also
# shows students "Talk to Student Support". New systems get it after db:seed (Studenthub::Setup).
class StudenthubDepartmentsSwitch < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::Departments.ensure!
  end

  def down
    Setting.find_by(name: Studenthub::Departments::SETTING)&.destroy
  end
end
