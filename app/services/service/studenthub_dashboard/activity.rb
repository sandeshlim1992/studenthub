# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

# Student Hub: the latest ticket activity for the dashboards, as "who did what on which ticket".
# Reads Zammad's activity stream (so it shows what the user may see) and leaves out everything
# that isn't about a ticket, such as sign-ins.
class Service::StudenthubDashboard::Activity < Service::Base
  requires_current_user!

  LIMIT = 8
  SCAN  = 60

  def execute
    ActivityStream.list(current_user, SCAN).lazy.filter_map { |entry| item(entry) }.first(LIMIT)
  end

  private

  def item(entry)
    object = ObjectLookup.by_id(entry.activity_stream_object_id)
    type   = TypeLookup.by_id(entry.activity_stream_type_id)

    ticket, action = case object
                     when 'Ticket'
                       [Ticket.find_by(id: entry.o_id), type == 'create' ? 'created' : 'updated']
                     when 'Ticket::Article'
                       article = Ticket::Article.find_by(id: entry.o_id)
                       [article&.ticket, article_action(article)]
                     end
    return if !ticket

    {
      id:         entry.id,
      action:     action,
      ticket:     { id: ticket.id, number: ticket.number, title: ticket.title },
      actor:      actor(entry.created_by_id),
      created_at: entry.created_at,
    }
  end

  def article_action(article)
    return 'replied' if !article
    return 'noted' if article.internal
    return 'wrote' if article.sender&.name == 'Customer'

    'replied'
  end

  def actor(user_id)
    user = User.find_by(id: user_id)
    return { id: nil, name: nil } if !user || user.id == 1

    { id: user.id, name: user.fullname }
  end
end
