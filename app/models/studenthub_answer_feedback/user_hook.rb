# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: a user's votes on Knowledge Base answers when the user is deleted or merged.
# Deleting: they go before Zammad's own callbacks, which refuse to delete a user that records still
# point at (User#destroy_move_dependency_ownership). Merging: one vote per student and answer, so
# where both users voted on an answer, the duplicate's vote goes and the remaining user's stays, as
# Zammad does with mentions; the others move with the rest.
module StudenthubAnswerFeedback::UserHook
  extend ActiveSupport::Concern

  prepended do
    before_destroy :destroy_studenthub_answer_feedbacks, prepend: true
  end

  def merge(user_id_of_duplicate_user)
    StudenthubAnswerFeedback
      .where(user_id: user_id_of_duplicate_user, answer_id: StudenthubAnswerFeedback.where(user_id: id).select(:answer_id))
      .delete_all

    super
  end

  private

  def destroy_studenthub_answer_feedbacks
    StudenthubAnswerFeedback.where(user: self).delete_all
  end
end
