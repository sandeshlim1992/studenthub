# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: sites (organisations) assigned to managers. A manager can read the tickets of their
# sites and gets a view of each one's open tickets (Studenthub::ManagerSites).
class StudenthubManagerSites < ActiveRecord::Migration[8.0]
  def up
    return if table_exists?(:studenthub_manager_sites)

    create_table :studenthub_manager_sites, id: :integer do |t|
      t.references :user,         type: :integer, null: false, foreign_key: { on_delete: :cascade }
      t.references :organization, type: :integer, null: false, foreign_key: { on_delete: :cascade }
      t.references :created_by,   type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by,   type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false

      t.index %i[user_id organization_id], unique: true
    end
  end

  def down
    Studenthub::TicketViews::ManagerSites.remove! if defined?(Studenthub::TicketViews::ManagerSites)
    drop_table :studenthub_manager_sites, if_exists: true
  end
end
