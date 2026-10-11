# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: departments (StudenthubDepartment), made by admins under Administration → Manage →
# Departments. A department has a name, the campuses it covers (values of the ticket's Campus
# field, which admins manage under Objects) and one email address. The feature has an on/off
# switch (setting studenthub_departments); while it is on, students see "Talk to Student Support".
module Studenthub::Departments
  PERMISSION   = 'admin.departments'.freeze
  CAMPUS_FIELD = 'campus'.freeze
  SETTING      = 'studenthub_departments'.freeze

  def self.enabled?
    Setting.get(SETTING) == true
  end

  # The campuses a department can cover, as { value:, label: }, read live from the Campus field.
  def self.campus_options
    Studenthub::RequestForms::Options.option_values(CAMPUS_FIELD)
  end

  def self.campus_values
    campus_options.pluck(:value)
  end

  # Creates the permission and the on/off setting (off). Idempotent; used by the 20261011100000
  # and 20261011130000 migrations and Studenthub::Setup.ensure_all!.
  def self.ensure!
    Permission.create_if_not_exists(
      name:        PERMISSION,
      label:       __('Departments'),
      description: __('Manage departments: their name, campuses and email address.'),
      preferences: { prio: 1148 }
    )
    Setting.create_if_not_exists(
      title:       __('Departments'),
      name:        SETTING,
      area:        'Studenthub::Departments',
      description: __('Turns on departments and the "Talk to Student Support" button for students.'),
      options:     { form: [{ display: '', null: true, name: SETTING, tag: 'boolean', options: { true => 'yes', false => 'no' } }] },
      state:       false,
      preferences: {
        permission:     [PERMISSION],
        authentication: true,
        hidden:         true, # switched on the new UI's Departments page, not in the classic admin
      },
      frontend:    true
    )
  end

  def self.remove!
    Setting.find_by(name: SETTING)&.destroy
    Permission.find_by(name: PERMISSION)&.destroy
  end
end
