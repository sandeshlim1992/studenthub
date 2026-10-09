# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: request forms (Studenthub::RequestForms). Each one is the extra ticket fields asked
# for when a ticket is raised under one Category › Sub-category. Admins edit a draft; publishing
# copies it to the live definition, which the core workflow "Student Hub - request forms" applies.
class StudenthubRequestForms < ActiveRecord::Migration[8.0]
  def up
    create_request_forms
    return if !Studenthub::Setup.seeded?

    Studenthub::RequestForms::Setup.ensure!
  end

  def down
    Studenthub::RequestForms::Setup.remove!
    drop_table :studenthub_request_forms, if_exists: true
  end

  private

  def create_request_forms
    return if table_exists?(:studenthub_request_forms)

    create_table :studenthub_request_forms, id: :integer do |t|
      t.jsonb      :draft,        null: false, default: {}
      t.jsonb      :published,    null: true
      t.datetime   :published_at, limit: 3, null: true
      t.references :published_by, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      t.references :created_by,   type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by,   type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false
    end
  end
end
