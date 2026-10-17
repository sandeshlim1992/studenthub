# Copyright (C) 2012-2026 Zammad Foundation, https://zammad-foundation.org/

class TicketOnlineNotificationSeenJob < ApplicationJob
  include HasActiveJobLock

  def lock_key
    ticket = arguments[0]

    # "TicketOnlineNotificationSeenJob/23/42"
    "#{self.class.name}/#{ticket.id}/#{arguments[1]}"
  end

  def perform(ticket, user_id)
    user_id ||= 1

    # set all online notifications to seen
    Transaction.execute do
      return if !OnlineNotification.seen_state?(ticket)

      mention_user_ids = ticket.mentions.map(&:user_id)

      # Student Hub: students' notifications (Transaction::StudenthubStudentNotification) stay unread,
      # as one saying their ticket was closed is the news itself.
      student_type_ids = TypeLookup.where(name: Transaction::StudenthubStudentNotification::TYPES).select(:id)

      unseen_notifications = OnlineNotification.list_by_object('Ticket', ticket.id)
                                               .where(seen: false)
                                               .where.not(user_id: mention_user_ids)
                                               .where.not(type_lookup_id: student_type_ids)

      return if unseen_notifications.empty?

      unseen_notifications.each { |n| n.update!(seen: true, updated_by_id: user_id) }
    end
  end
end
