# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Creates the permission and settings the Feedback Collection feature needs.
# Idempotent. Used by the 20261003120000 migration and by the test suite, which empties
# all tables and re-runs only Zammad's own seeds between runs.
module Studenthub::FeedbackCollection::Setup
  SETTING_NAMES = %w[
    feedback_collection
    feedback_collection_config
    feedback_collection_email_subject
    feedback_collection_email_template
    9700_feedback_collection
  ].freeze

  def self.ensure!
    create_permission
    create_settings
  end

  def self.remove!
    Setting.where(name: SETTING_NAMES).destroy_all
    Permission.find_by(name: 'admin.feedback_collection')&.destroy
  end

  def self.create_permission
    Permission.create_if_not_exists(
      name:        'admin.feedback_collection',
      label:       __('Feedback Collection'),
      description: __('Manage customer feedback requests and results.'),
      preferences: { prio: 1145 }
    )
  end

  def self.create_settings
    Setting.create_if_not_exists(
      title:       __('Feedback Collection'),
      name:        'feedback_collection',
      area:        'Integration::FeedbackCollection',
      description: __('Sends customers a rating request when their ticket is closed.'),
      options:     { form: [{ display: '', null: true, name: 'feedback_collection', tag: 'boolean', options: { true => 'yes', false => 'no' } }] },
      state:       false,
      preferences: { permission: ['admin.feedback_collection'] },
      frontend:    false
    )

    Setting.create_if_not_exists(
      title:       __('Feedback Collection configuration'),
      name:        'feedback_collection_config',
      area:        'Integration::FeedbackCollection',
      description: __('Delivery, conditions and notification settings for feedback requests.'),
      options:     {},
      state:       {
        channel_id:        nil,
        from_name:         __('Student Hub Feedback'),
        from_email:        'feedback@studenthub.ac',
        reply_to:          'feedback@studenthub.ac',
        notify_email:      '',
        group_ids:         [],
        require_owner:     true,
        skip_tags:         ['spam'],
        resend_after_days: 0,
        add_internal_note: true,
      },
      preferences: { permission: ['admin.feedback_collection'] },
      frontend:    false
    )

    Setting.create_if_not_exists(
      title:       __('Feedback request email subject'),
      name:        'feedback_collection_email_subject',
      area:        'Integration::FeedbackCollection',
      description: __('Subject of the feedback request email. Supports {{ticket_number}} and the other template placeholders.'),
      options:     {},
      state:       'Service Feedback Request: Ticket #{{ticket_number}}',
      preferences: { permission: ['admin.feedback_collection'] },
      frontend:    false
    )

    # Blank means "use the built-in default template".
    Setting.create_if_not_exists(
      title:       __('Feedback request email template'),
      name:        'feedback_collection_email_template',
      area:        'Integration::FeedbackCollection',
      description: __('HTML body of the feedback request email.'),
      options:     {},
      state:       '',
      preferences: { permission: ['admin.feedback_collection'] },
      frontend:    false
    )

    Setting.create_if_not_exists(
      title:       __('Defines transaction backend.'),
      name:        '9700_feedback_collection',
      area:        'Transaction::Backend::Async',
      description: __('Defines the transaction backend to send feedback requests when tickets are closed.'),
      options:     {},
      state:       'Transaction::FeedbackCollection',
      frontend:    false
    )
  end
end
