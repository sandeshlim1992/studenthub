# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: "Was this helpful?" under a Knowledge Base answer in the mobile app, one vote per
# student and answer. See StudenthubAnswerFeedback.
class StudenthubAnswerFeedbacks < ActiveRecord::Migration[8.0]
  def up
    return if table_exists?(:studenthub_answer_feedbacks)

    create_table :studenthub_answer_feedbacks, id: :integer do |t|
      t.references :answer,  type: :integer, null: false, foreign_key: { to_table: :knowledge_base_answers, on_delete: :cascade }, index: false
      t.references :user,    type: :integer, null: false, foreign_key: { on_delete: :cascade }
      t.boolean    :helpful, null: false # rubocop:disable Rails/ThreeStateBooleanColumn -- every row is a yes or no someone chose, so no default
      t.timestamps limit: 3, null: false
    end
    add_index :studenthub_answer_feedbacks, %i[answer_id user_id], unique: true
  end

  def down
    drop_table :studenthub_answer_feedbacks, if_exists: true
  end
end
