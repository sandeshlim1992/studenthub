# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: what admins set for the students' mobile app under Administration → Manage →
# Mobile app, both on its home screen and only for signed-in users: the quick links (links to
# other websites, each a label and an http(s) address) and the popular answers (Knowledge Base
# answers published in the help center, see PopularAnswers), in the admins' order. Also the
# notifications that tell students about their tickets (Transaction::StudenthubStudentNotification).
module Studenthub::MobileApp
  PERMISSION            = 'admin.mobile_app'.freeze
  QUICK_LINKS           = 'studenthub_mobile_quick_links'.freeze
  POPULAR_ANSWERS       = 'studenthub_mobile_popular_answers'.freeze
  STUDENT_NOTIFICATIONS = '9710_studenthub_student_notification'.freeze

  # The new UI's admin page and the mobile app use the same limits (studenthubQuickLinks.ts,
  # MobileAppPopularAnswers.vue).
  MAX_QUICK_LINKS     = 8
  MAX_LABEL_LENGTH    = 40
  MAX_URL_LENGTH      = 500
  MAX_POPULAR_ANSWERS = 5

  # Creates the permission, the two settings (empty) and the students' notifications. Idempotent;
  # used by the 20261016110000, 20261017100000 and 20261017120000 migrations and
  # Studenthub::Setup.ensure_all!.
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
    # Not sent with the app config: the mobile app asks for the chosen answers that are still
    # published (GET /api/v1/studenthub/mobile_app/popular_answers).
    Setting.create_if_not_exists(
      title:       __('Mobile app popular answers'),
      name:        POPULAR_ANSWERS,
      area:        'Studenthub::MobileApp',
      description: __('Knowledge Base answers on the home screen of the mobile app.'),
      options:     {},
      state:       [],
      preferences: {
        permission:  [PERMISSION],
        validations: ['Setting::Validation::StudenthubMobilePopularAnswers'],
        hidden:      true,
      },
      frontend:    false
    )
    Setting.create_if_not_exists(
      title:       __('Defines transaction backend.'),
      name:        STUDENT_NOTIFICATIONS,
      area:        'Transaction::Backend::Async',
      description: __('Defines the transaction backend to tell students about replies and changes on their tickets.'),
      options:     {},
      state:       'Transaction::StudenthubStudentNotification',
      frontend:    false
    )
  end

  def self.remove!
    Setting.find_by(name: STUDENT_NOTIFICATIONS)&.destroy
    Setting.find_by(name: POPULAR_ANSWERS)&.destroy
    Setting.find_by(name: QUICK_LINKS)&.destroy
    Permission.find_by(name: PERMISSION)&.destroy
  end
end
