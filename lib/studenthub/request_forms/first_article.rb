# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Included into Ticket::Article by config/initializers/studenthub_request_forms.rb.
# When a ticket's first message is created and a published request form applies to the ticket
# (its Category › Sub-category and customer), the message starts with the form's Request
# details block and remembers which form and version it came from. The answers to the form's own
# questions come with the message (preferences 'studenthub_request_answers', sent by the new UI):
# they are checked against the form, a required one missing stops the ticket, and they are saved
# as a StudenthubRequestAnswer. Emails that arrive through a mail channel are left as they are:
# they don't come through a form.
module Studenthub::RequestForms::FirstArticle
  extend ActiveSupport::Concern

  SENT_KEY = 'studenthub_request_answers'.freeze

  included do
    before_create :studenthub_add_request_details
    after_create  :studenthub_save_request_answers
  end

  private

  def studenthub_add_request_details
    sent = studenthub_take_sent_answers
    return if ApplicationHandleInfo.postmaster?
    return if !ticket || Ticket::Article.exists?(ticket_id: ticket_id)

    form = Studenthub::RequestForms.applicable(
      ticket[Studenthub::RequestForms::CATEGORY_FIELD],
      ticket[Studenthub::RequestForms::SUB_CATEGORY_FIELD],
      ticket.customer,
    )
    return if !form

    questions = Studenthub::RequestForms::Questions.of(form)
    answers   = Studenthub::RequestForms::Questions.clean_answers(questions, sent.to_h['answers'])
    studenthub_check_required!(questions, answers) if sent

    block = Studenthub::RequestForms::Details.build(form, ticket, html: content_type == 'text/html', answers:)
    @studenthub_request_answers = { form:, questions:, answers: } if answers.present?
    return if block.blank?

    self.body = "#{block}#{body}"
    self.preferences = (preferences || {}).merge(
      'studenthub_request_form' => { 'id' => form['id'], 'version' => form['version'] },
    )
  end

  # The answers sent with the message, taken out of its preferences (they are saved apart).
  def studenthub_take_sent_answers
    return if preferences.blank?

    sent = preferences.delete(SENT_KEY) || preferences.delete(SENT_KEY.to_sym)
    sent.respond_to?(:to_unsafe_h) ? sent.to_unsafe_h : sent
  end

  # Only tickets from the new UI send answers; the classic UI and the API can't ask the questions.
  def studenthub_check_required!(questions, answers)
    missing = Studenthub::RequestForms::Questions.unanswered(questions, answers)
    return if missing.empty?

    raise Exceptions::UnprocessableContent, format(__('Please answer: %s'), missing.pluck('label').join(', '))
  end

  def studenthub_save_request_answers
    return if !@studenthub_request_answers

    form = @studenthub_request_answers[:form]
    StudenthubRequestAnswer.create!(
      ticket_id:         ticket_id,
      ticket_article_id: id,
      request_form_id:   form['id'],
      form_version:      form['version'],
      questions:         @studenthub_request_answers[:questions],
      answers:           @studenthub_request_answers[:answers],
    )
  end
end
