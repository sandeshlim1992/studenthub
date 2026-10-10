# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# The answers to a request form's own questions for one ticket (Studenthub::RequestForms::Questions):
# `answers` (key => value) and the `questions` as they were when the ticket was raised.
class StudenthubRequestAnswer < ApplicationModel
  belongs_to :ticket
  belongs_to :ticket_article, class_name: 'Ticket::Article', optional: true
  belongs_to :request_form, class_name: 'StudenthubRequestForm', optional: true
end
