# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: native feedback collection (replaces the PHP feedback.php add-on).
#
# Unlike Zammad's own migrations this one has no "new setup" guard: Zammad adds new tables
# for fresh installs to its base migration, which Student Hub must not edit. Running it on
# both fresh and existing systems keeps the feature in new files only.
class StudenthubFeedbackCollection < ActiveRecord::Migration[8.0]
  def up
    create_feedback_requests
    Studenthub::FeedbackCollection::Setup.ensure!
  end

  def down
    Studenthub::FeedbackCollection::Setup.remove!
    drop_table :feedback_requests, if_exists: true
  end

  private

  def create_feedback_requests
    return if table_exists?(:feedback_requests)

    create_table :feedback_requests, id: :integer do |t| # rubocop:disable Metrics/BlockLength
      t.references :ticket, type: :integer, null: true, foreign_key: { on_delete: :nullify }
      t.string     :ticket_number, limit: 60,  null: false
      t.string     :ticket_title,  limit: 250, null: false, default: ''
      t.references :customer, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string     :customer_email, limit: 255, null: false, default: ''
      t.string     :customer_name,  limit: 150, null: false, default: ''
      t.references :owner, type: :integer, null: true, foreign_key: { to_table: :users, on_delete: :nullify }
      t.string     :owner_name, limit: 150, null: false, default: ''
      t.references :group, type: :integer, null: true, foreign_key: { on_delete: :nullify }
      t.string     :group_name, limit: 160, null: false, default: ''

      # Only a SHA-256 digest of the emailed token is stored, never the token itself.
      t.string     :token_digest, limit: 64, null: false
      t.string     :state,  limit: 20, null: false, default: 'pending'
      t.string     :source, limit: 20, null: false, default: 'native'
      t.datetime   :sent_at, limit: 3, null: true
      t.string     :error, limit: 500, null: true

      t.integer    :rating,   null: true
      t.text       :comments, null: true
      t.datetime   :rated_at, limit: 3, null: true

      t.references :created_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.references :updated_by, type: :integer, null: false, foreign_key: { to_table: :users }
      t.timestamps limit: 3, null: false

      t.index :token_digest, unique: true
      t.index :state
      t.index :rating
      t.index :rated_at
      t.index :created_at
    end
  end
end
