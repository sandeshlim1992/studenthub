# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what admins set for the students' mobile app under Administration → Manage →
# Mobile app. For now the quick links on its home screen: links to other websites, each a label
# and an http(s) address, in the admins' order. Only signed-in users get them.
module Studenthub::MobileApp
  PERMISSION  = 'admin.mobile_app'.freeze
  QUICK_LINKS = 'studenthub_mobile_quick_links'.freeze

  # The new UI's admin page and the mobile app use the same limits (studenthubQuickLinks.ts).
  MAX_QUICK_LINKS  = 8
  MAX_LABEL_LENGTH = 40
  MAX_URL_LENGTH   = 500

  # Creates the permission and the quick links setting (no links). Idempotent; used by the
  # 20261016110000 migration and Studenthub::Setup.ensure_all!.
  def self.ensure!
    Permission.create_if_not_exists(
      name:        PERMISSION,
      label:       __('Mobile app'),
      description: __('Customise the mobile app, e.g. the quick links on its home screen.'),
      preferences: { prio: 1149 }
    )
    Setting.create_if_not_exists(
      title:       __('Mobile app quick links'),
      name:        QUICK_LINKS,
      area:        'Studenthub::MobileApp',
      description: __('Links to other websites on the home screen of the mobile app.'),
      options:     {},
      state:       [],
      preferences: {
        permission:     [PERMISSION],
        validations:    ['Setting::Validation::StudenthubMobileQuickLinks'],
        authentication: true,
        hidden:         true, # edited on the new UI's Mobile app page, not in the classic admin
      },
      frontend:    true
    )
  end

  def self.remove!
    Setting.find_by(name: QUICK_LINKS)&.destroy
    Permission.find_by(name: PERMISSION)&.destroy
  end
end
