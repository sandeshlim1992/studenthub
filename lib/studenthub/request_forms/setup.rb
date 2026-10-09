# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Creates what request forms need: the admin permission and the core workflow that applies the
# published forms (locked: it isn't listed among the admins' own core workflows). Idempotent.
# Used by the 20261009100000 migration and by the test suite, which empties all tables between runs.
module Studenthub::RequestForms::Setup
  MODULE_NAME = 'CoreWorkflow::Custom::StudenthubRequestForm'.freeze

  def self.ensure!
    create_permission
    create_workflow
  end

  def self.remove!
    CoreWorkflow.find_by(name: Studenthub::RequestForms::WORKFLOW_NAME)&.destroy
    Permission.find_by(name: Studenthub::RequestForms::PERMISSION)&.destroy
  end

  def self.create_permission
    Permission.create_if_not_exists(
      name:        Studenthub::RequestForms::PERMISSION,
      label:       __('Request forms'),
      description: __('Choose the extra fields asked for when a ticket is raised under a sub-category.'),
      preferences: { prio: 1147 }
    )
  end

  # Runs after the admins' own workflows (Student Hub's narrow Sub-category by Category at 501–503),
  # so a form's fields end up shown and required whatever those did.
  def self.create_workflow
    CoreWorkflow.create_if_not_exists(
      name:            Studenthub::RequestForms::WORKFLOW_NAME,
      object:          'Ticket',
      condition_saved: {
        'custom.module': {
          operator: 'match all modules',
          value:    [MODULE_NAME],
        },
      },
      perform:         {
        'custom.module': {
          execute: [MODULE_NAME]
        },
      },
      changeable:      false,
      priority:        900,
      created_by_id:   1,
      updated_by_id:   1,
    )
  end
end
