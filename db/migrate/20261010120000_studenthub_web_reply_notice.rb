# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: agents can reply on the web; a trigger emails the student a notice about it.
class StudenthubWebReplyNotice < ActiveRecord::Migration[8.0]
  def up
    return if !Studenthub::Setup.seeded?

    Studenthub::WebReplyNotice.ensure!
  end
end
