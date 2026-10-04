# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

FactoryBot.define do
  factory :feedback_request do
    transient do
      token { FeedbackRequest.generate_token }
    end

    ticket         { association :ticket }
    ticket_number  { ticket&.number || '884456' }
    ticket_title   { ticket&.title || 'Outlook issue' }
    customer_email { 'student@example.com' }
    customer_name  { 'Amira' }
    owner_name     { 'Borice' }
    group_name     { 'Service Desk' }
    token_digest   { FeedbackRequest.digest(token) }
    state          { 'sent' }
    source         { 'native' }
    created_by_id  { 1 }
    updated_by_id  { 1 }

    trait :submitted do
      state    { 'submitted' }
      rating   { 5 }
      comments { 'Great help' }
      rated_at { Time.zone.now }
    end
  end
end
