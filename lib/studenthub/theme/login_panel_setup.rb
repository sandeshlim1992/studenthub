# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub theme: the heading, tagline and description in the sign-in page's brand panel.
# Admins change them on the Branding page. An empty text hides that line.
# Idempotent. Used by the 20261011120000 migration and by the test suite, which empties
# all tables and re-runs only Zammad's own seeds between runs.
module Studenthub::Theme::LoginPanelSetup
  # Longest allowed text per field; the frontend uses the same limits (studenthubLoginPanel.ts).
  MAX_LENGTHS = {
    'heading'     => 60,
    'tagline'     => 120,
    'description' => 300,
  }.freeze

  DEFAULTS = {
    'heading'     => __('Student Hub'),
    'tagline'     => __('Your support, simplified.'),
    'description' => __('IT and student support for LSST, FSB and UKBC. Ask for help, follow your requests and find answers in one place.'),
  }.freeze

  def self.ensure!
    Setting.create_if_not_exists(
      title:       __('Sign-in page texts'),
      name:        'studenthub_login_panel',
      area:        'System::Branding',
      description: __('Heading, tagline and description on the sign-in page of the new UI.'),
      options:     {},
      state:       DEFAULTS,
      preferences: {
        permission:  ['admin.branding'],
        validations: ['Setting::Validation::StudenthubLoginPanel'],
        hidden:      true, # edited on the new UI's Branding page, not in the classic admin
      },
      frontend:    true
    )
  end

  def self.remove!
    Setting.find_by(name: 'studenthub_login_panel')&.destroy
  end
end
