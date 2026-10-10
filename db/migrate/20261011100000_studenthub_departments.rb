# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: departments (Studenthub::Departments): a name, the campuses covered and one email
# address each, made by admins.
class StudenthubDepartments < ActiveRecord::Migration[8.0]
  def up
    create_departments
    return if !Studenthub::Setup.seeded?

    Studenthub::Departments.ensure!
  end

  def down
    Studenthub::Departments.remove!
    drop_table :studenthub_departments, if_exists: true
  end

  private

  def create_departments
    return if table_exists?(:studenthub_departments)

    create_table :studenthub_departments, id: :integer do |t|
      t.string     :name,       limit: 150, null: false
      t.jsonb      :locations,  null: false, default: []
      t.string     :email,      limit: 255, null: false
      t.references :created_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false
    end
    add_index :studenthub_departments, 'LOWER(name)', unique: true, name: 'index_studenthub_departments_on_lower_name'
  end
end
