# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class Controllers::FeedbackCollectionControllerPolicy < Controllers::ApplicationControllerPolicy
  default_permit!('admin.feedback_collection')
end
