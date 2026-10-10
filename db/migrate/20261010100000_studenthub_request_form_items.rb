# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: request forms list their content as items (questions, headings, notes) in order.
# Forms made before that only had their questions (`fields`); they get the same questions as
# items, so drafts and published forms stay as they were.
class StudenthubRequestFormItems < ActiveRecord::Migration[8.0]
  def up
    return if !table_exists?(:studenthub_request_forms)

    StudenthubRequestForm.reset_column_information
    # Only the layout of what is stored changes; the forms' checks don't need to run again.
    StudenthubRequestForm.find_each do |form|
      form.update_columns( # rubocop:disable Rails/SkipsModelValidations
        draft:     StudenthubRequestForm.normalize_definition(form.draft),
        published: form.published && StudenthubRequestForm.normalize_definition(form.published),
      )
    end
  end
end
