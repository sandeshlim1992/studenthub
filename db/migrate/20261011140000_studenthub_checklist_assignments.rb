# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: checklists added automatically to tickets in a Category › Sub-category
# (Studenthub::ChecklistAssignments). On a seeded system the old way of doing it, triggers that
# call a webhook posting to Zammad's own checklists API, becomes assignments
# (Studenthub::ChecklistAssignments::WebhookTriggers); the triggers keep their other actions.
class StudenthubChecklistAssignments < ActiveRecord::Migration[8.0]
  def up
    create_assignments
    return if !Studenthub::Setup.seeded?

    StudenthubChecklistAssignment.reset_column_information
    Studenthub::ChecklistAssignments::WebhookTriggers.convert!.each { |line| say line }
  end

  # The converted triggers don't get their webhook action back, nor the webhooks their switch:
  # put them back by hand if needed.
  def down
    drop_table :studenthub_checklist_assignments, if_exists: true
  end

  private

  def create_assignments
    return if table_exists?(:studenthub_checklist_assignments)

    create_table :studenthub_checklist_assignments, id: :integer do |t|
      t.string     :category,           limit: 250, null: false
      t.string     :sub_category,       limit: 250, null: false
      t.references :checklist_template, type: :integer, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by,         type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by,         type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false
    end
    add_index :studenthub_checklist_assignments, %i[category sub_category], unique: true, name: 'index_studenthub_checklist_assignments_on_pair'
  end
end
