# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: departments (StudenthubDepartment), made by admins under Administration → Manage →
# Departments. A department has a name, the campuses it covers (values of the ticket's Campus
# field, which admins manage under Objects) and one email address.
module Studenthub::Departments
  PERMISSION   = 'admin.departments'.freeze
  CAMPUS_FIELD = 'campus'.freeze

  # The campuses a department can cover, as { value:, label: }, read live from the Campus field.
  def self.campus_options
    Studenthub::RequestForms::Options.option_values(CAMPUS_FIELD)
  end

  def self.campus_values
    campus_options.pluck(:value)
  end

  # Creates the permission. Idempotent; used by the 20261011100000 migration and
  # Studenthub::Setup.ensure_all!.
  def self.ensure!
    Permission.create_if_not_exists(
      name:        PERMISSION,
      label:       __('Departments'),
      description: __('Manage departments: their name, campuses and email address.'),
      preferences: { prio: 1148 }
    )
  end

  def self.remove!
    Permission.find_by(name: PERMISSION)&.destroy
  end
end
