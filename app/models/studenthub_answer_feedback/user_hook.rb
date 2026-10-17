# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: a user's votes on Knowledge Base answers go when the user is deleted. They go before
# Zammad's own callbacks, which refuse to delete a user that records still point at
# (User#destroy_move_dependency_ownership).
module StudenthubAnswerFeedback::UserHook
  extend ActiveSupport::Concern

  included do
    before_destroy :destroy_studenthub_answer_feedbacks, prepend: true
  end

  private

  def destroy_studenthub_answer_feedbacks
    StudenthubAnswerFeedback.where(user: self).delete_all
  end
end
