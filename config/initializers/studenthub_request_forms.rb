# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub request forms, added to Zammad's classes without editing them: a ticket raised under
# a request form gets the form's Request details block at the top of its first message.
Rails.application.config.to_prepare do
  Ticket::Article.include(Studenthub::RequestForms::FirstArticle) if !(Ticket::Article < Studenthub::RequestForms::FirstArticle)
end
