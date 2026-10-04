# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub theme: the application colour admins choose under Branding.
# Idempotent. Used by the 20261004160000 migration and by the test suite, which empties
# all tables and re-runs only Zammad's own seeds between runs.
module Studenthub::Theme::Setup
  DEFAULT_APP_COLOR = '#14234b'.freeze # navy from the Student Hub logo

  def self.ensure!
    Setting.create_if_not_exists(
      title:       __('Application colour'),
      name:        'studenthub_app_color',
      area:        'System::Branding',
      description: __('Colour of the navigation, the top of the sign-in page and the main buttons in the new UI.'),
      options:     {},
      state:       DEFAULT_APP_COLOR,
      preferences: {
        permission:  ['admin.branding'],
        validations: ['Setting::Validation::StudenthubAppColor'],
      },
      frontend:    true
    )
  end

  def self.remove!
    Setting.find_by(name: 'studenthub_app_color')&.destroy
  end
end
