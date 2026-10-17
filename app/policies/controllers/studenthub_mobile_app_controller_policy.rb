# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Admins of the mobile app see what they can choose; everyone who uses the app sees Home's answers,
# which are published in the help center anyway.
class Controllers::StudenthubMobileAppControllerPolicy < Controllers::ApplicationControllerPolicy
  permit! :answer_choices, to: Studenthub::MobileApp::PERMISSION
  permit! :popular_answers, to: ['ticket.customer', 'ticket.agent']
end
