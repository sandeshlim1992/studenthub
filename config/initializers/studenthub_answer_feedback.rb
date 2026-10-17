# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: deleting a user also deletes their votes on Knowledge Base answers
# (StudenthubAnswerFeedback), added to Zammad's User without editing it.
Rails.application.config.to_prepare do
  User.include(StudenthubAnswerFeedback::UserHook) if User.ancestors.exclude?(StudenthubAnswerFeedback::UserHook)
end
