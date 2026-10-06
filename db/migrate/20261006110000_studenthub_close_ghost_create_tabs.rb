# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: Recent in the new UI keeps tickets and drafts only. From now on an untouched New
# ticket tab closes when the agent leaves it; this closes the ones left behind until now (nothing
# typed in them). Tabs with typed content stay, as drafts.
class StudenthubCloseGhostCreateTabs < ActiveRecord::Migration[8.0]
  UNTOUCHED_KEYS = %w[form_id formSenderType].freeze

  def up
    return if !table_exists?(:taskbars)

    Taskbar.where(app: 'desktop').where('key LIKE ?', 'TicketCreateScreen-%').find_each do |taskbar|
      next if taskbar.state.to_h.except(*UNTOUCHED_KEYS).compact_blank.present?

      taskbar.destroy
    end
  end
end
