# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: deleting or merging a user also takes care of their votes on Knowledge Base answers
# (StudenthubAnswerFeedback), added to Zammad's User without editing it. Prepended, as merging runs
# before User#merge.
Rails.application.config.to_prepare do
  User.prepend(StudenthubAnswerFeedback::UserHook) if User.ancestors.exclude?(StudenthubAnswerFeedback::UserHook)
end
