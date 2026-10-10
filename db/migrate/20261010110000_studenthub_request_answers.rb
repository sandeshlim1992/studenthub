# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the answers to a request form's own questions (not Zammad ticket fields), one row per
# ticket raised under the form, with the questions as they were then so the answers stay readable
# after the form changes. See Studenthub::RequestForms::Questions.
class StudenthubRequestAnswers < ActiveRecord::Migration[8.0]
  def up
    return if table_exists?(:studenthub_request_answers)

    create_table :studenthub_request_answers, id: :integer do |t|
      t.references :ticket,          type: :integer, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.references :ticket_article,  type: :integer, null: true,  foreign_key: { on_delete: :nullify }
      t.references :request_form,    type: :integer, null: true,  foreign_key: { to_table: :studenthub_request_forms, on_delete: :nullify }
      t.string     :form_version,    limit: 40, null: true
      t.jsonb      :questions,       null: false, default: []
      t.jsonb      :answers,         null: false, default: {}
      t.timestamps limit: 3, null: false
    end
  end

  def down
    drop_table :studenthub_request_answers, if_exists: true
  end
end
