# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins of the mobile app see what they can choose; everyone who uses the app sees Home's answers
# and the Knowledge Base, which are published in the help center anyway. Only students vote on
# whether an answer helped.
class Controllers::StudenthubMobileAppControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! :answer_choices, to: Studenthub::MobileApp::PERMISSION
  permit! %i[popular_answers knowledge_base_topic knowledge_base_answer knowledge_base_search], to: ['ticket.customer', 'ticket.agent']
  permit! :knowledge_base_feedback, to: 'ticket.customer'
end
