# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Agents can reply on the web (the reply box's Email / Web choice). A web reply isn't emailed, so a
# trigger emails the student a short notice with a link to the ticket instead of the reply itself.
# The notice is kept on the ticket as an internal message. Admins can change the wording or switch
# it off under Triggers; ensure! only creates it when no trigger has its name, so their changes stay.
module Studenthub::WebReplyNotice
  TRIGGER_NAME = 'Agent replied on the web : Email Notification to Customer'.freeze # rubocop:disable Zammad/DetectTranslatableString -- a record name

  # Zammad adds the ticket number to the subject when it sends the email.
  # rubocop:disable Lint/InterpolationCheck
  SUBJECT = 'New reply to your request: #{ticket.title}'.freeze

  BODY = <<~HTML.freeze
    <div>Hi \#{ticket.customer.firstname},</div>
    <div><br></div>
    <div>There is a new reply to your request "\#{ticket.title}" (ticket \#{ticket.number}).</div>
    <div><br></div>
    <div><a href="\#{config.http_type}://\#{config.fqdn}/tickets/\#{ticket.id}">Read the reply in \#{config.product_name}</a></div>
    <div><br></div>
    <div>Best regards,</div>
    <div>\#{config.product_name}</div>
  HTML
  # rubocop:enable Lint/InterpolationCheck

  def self.ensure!
    return if Trigger.exists?(name: TRIGGER_NAME)

    Trigger.create!(
      name:                     TRIGGER_NAME,
      condition:                {
        'article.action'    => { 'operator' => 'is', 'value' => 'create' },
        'article.type_id'   => { 'operator' => 'is', 'value' => [Ticket::Article::Type.lookup(name: 'web').id] },
        'article.sender_id' => { 'operator' => 'is', 'value' => [Ticket::Article::Sender.lookup(name: 'Agent').id] },
        'article.internal'  => { 'operator' => 'is', 'value' => 'false' },
      },
      perform:                  {
        'notification.email' => {
          'recipient'           => ['ticket_customer'],
          'subject'             => SUBJECT,
          'body'                => BODY,
          'internal'            => 'true',
          'include_attachments' => 'false',
        },
      },
      activator:                'action',
      execution_condition_mode: 'selective',
      active:                   true,
      created_by_id:            1,
      updated_by_id:            1,
    )
  end
end
